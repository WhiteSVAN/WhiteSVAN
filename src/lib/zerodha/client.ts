/**
 * Kite Connect calls for the firm's own Zerodha account (server only). Kite's limits: 3 historical
 * requests and 1 quote request a second; see kite.ts on who may see the data.
 */
import { LOOKBACK_DAYS, type Candle, type Interval } from "@/lib/market-data/candles";
import type { Underlying } from "@/lib/trading/instruments";
import { toIst } from "@/lib/trading/time";
import type { KiteConfig } from "./config";
import {
  historicalPath,
  historicalRanges,
  KiteError,
  kiteData,
  mergeCandles,
  parseCandles,
  parseContracts,
  parseLogin,
  parseLtpTokens,
  parseQuotes,
  UNDERLYINGS,
  type DerivativesExchange,
  type KiteContract,
  type KiteLogin,
  type MarketQuote,
} from "./kite";
import { sessionChecksum } from "./session";

interface CallOptions {
  accessToken?: string;
  method?: "GET" | "POST" | "DELETE";
  form?: Record<string, string>;
}

async function send(config: KiteConfig, path: string, options: CallOptions): Promise<Response> {
  const headers: Record<string, string> = { "X-Kite-Version": "3" };
  if (options.accessToken) headers.Authorization = `token ${config.apiKey}:${options.accessToken}`;
  if (options.form) headers["Content-Type"] = "application/x-www-form-urlencoded";
  try {
    return await fetch(`${config.apiRoot}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.form ? new URLSearchParams(options.form) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new KiteError("Zerodha could not be reached.", 504, "NetworkException");
  }
}

async function failure(response: Response): Promise<KiteError> {
  try {
    kiteData(await response.json(), response.status);
  } catch (error) {
    if (error instanceof KiteError && error.errorType !== "DataException") return error;
  }
  const type = response.status === 429 ? "RateLimitException" : response.status === 403 ? "TokenException" : "GeneralException";
  return new KiteError(`Zerodha returned HTTP ${response.status}.`, response.status, type);
}

async function callJson(config: KiteConfig, path: string, options: CallOptions = {}): Promise<unknown> {
  const response = await send(config, path, options);
  if (!response.ok) throw await failure(response);
  return response.json().catch(() => {
    throw new KiteError("Zerodha sent a response this app cannot read.", 502, "DataException");
  });
}

/** Trade the one-time request token from the login redirect for the day's access token. */
export async function createSession(config: KiteConfig, requestToken: string): Promise<KiteLogin> {
  const checksum = sessionChecksum(config.apiKey, requestToken, config.apiSecret);
  return parseLogin(await callJson(config, "/session/token", { method: "POST", form: { api_key: config.apiKey, request_token: requestToken, checksum } }));
}

/** Invalidate the access token at Kite. Kite web and mobile stay logged in. */
export async function endSession(config: KiteConfig, accessToken: string): Promise<void> {
  const query = new URLSearchParams({ api_key: config.apiKey, access_token: accessToken });
  await callJson(config, `/session/token?${query}`, { method: "DELETE", accessToken });
}

/** The interval's lookback of candles up to `now`, with open interest for futures and options. */
export async function fetchCandles(config: KiteConfig, accessToken: string, instrumentToken: number, interval: Interval, withOi: boolean, now: number): Promise<Candle[]> {
  const lists: Candle[][] = [];
  for (const [from, to] of historicalRanges(now - LOOKBACK_DAYS[interval] * 86_400_000, now, interval)) {
    lists.push(parseCandles(await callJson(config, historicalPath(instrumentToken, interval, from, to, withOi), { accessToken })));
  }
  return mergeCandles(lists);
}

export async function fetchQuotes(config: KiteConfig, accessToken: string, keys: readonly string[], now: number): Promise<MarketQuote[]> {
  const query = new URLSearchParams(keys.map((key) => ["i", key]));
  return parseQuotes(await callJson(config, `/quote?${query}`, { accessToken }), now);
}

// Kite's index tokens never change, and its instrument list changes once a day: keep both in
// memory for this server instance.
const indexTokens = new Map<Underlying, number>();
const contractLists = new Map<string, Promise<KiteContract[]>>();

export async function indexToken(config: KiteConfig, accessToken: string, underlying: Underlying): Promise<number> {
  const known = indexTokens.get(underlying);
  if (known) return known;
  const keys = Object.values(UNDERLYINGS).map((item) => item.indexKey);
  const tokens = parseLtpTokens(await callJson(config, `/quote/ltp?${new URLSearchParams(keys.map((key) => ["i", key]))}`, { accessToken }));
  for (const [name, item] of Object.entries(UNDERLYINGS) as [Underlying, (typeof UNDERLYINGS)[Underlying]][]) {
    const token = tokens.get(item.indexKey);
    if (token) indexTokens.set(name, token);
  }
  const token = indexTokens.get(underlying);
  if (!token) throw new KiteError(`Zerodha did not return ${UNDERLYINGS[underlying].label}.`, 502, "DataException");
  return token;
}

/** Today's NIFTY, BANK NIFTY or SENSEX futures and options on one exchange. */
export function fetchContracts(config: KiteConfig, accessToken: string, exchange: DerivativesExchange, now: number): Promise<KiteContract[]> {
  const cacheKey = `${exchange}:${toIst(now).date}`;
  const cached = contractLists.get(cacheKey);
  if (cached) return cached;
  const loading = (async () => {
    const response = await send(config, `/instruments/${exchange}`, { accessToken });
    if (!response.ok) throw await failure(response);
    return parseContracts(await response.text());
  })();
  for (const key of contractLists.keys()) if (key.startsWith(`${exchange}:`)) contractLists.delete(key);
  contractLists.set(cacheKey, loading);
  loading.catch(() => contractLists.delete(cacheKey));
  return loading;
}
