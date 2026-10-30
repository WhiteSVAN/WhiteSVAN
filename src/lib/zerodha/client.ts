/**
 * Market data for the charts, the option chain and the trading platform: Global Datafeeds
 * (src/lib/gfdl). The firm's Kite Connect calls are commented out below for now (founder,
 * 30 Oct 2026); to bring Kite back, restore them and the routes in
 * src/app/api/zerodha/{login,callback,logout}. The Kite config and token arguments stay so the
 * call sites don't change; they are unused.
 */
import { gfdlConfig } from "@/lib/gfdl/config";
import { gfdlCandles, gfdlChain, gfdlContractForToken, gfdlIndexToken, gfdlQuotes } from "@/lib/gfdl/feed";
import type { Candle, Interval } from "@/lib/market-data/candles";
import type { Underlying } from "@/lib/trading/instruments";
import type { KiteConfig } from "./config";
import type { KiteContract, MarketQuote } from "./kite";

/** The interval's lookback of candles up to `now`, with open interest for options. */
export function fetchCandles(_config: KiteConfig, _accessToken: string, instrumentToken: number, interval: Interval, withOi: boolean, now: number): Promise<Candle[]> {
  return gfdlCandles(gfdlConfig(), instrumentToken, interval, withOi, now);
}

/** Quotes with the best bid and offer, from the shared connection's pushes. */
export function fetchQuotes(_config: KiteConfig, _accessToken: string, keys: readonly string[]): Promise<MarketQuote[]> {
  return gfdlQuotes(gfdlConfig(), keys);
}

/** The token of the future that stands in for an index. */
export async function indexToken(_config: KiteConfig, _accessToken: string, underlying: Underlying): Promise<number> {
  return gfdlIndexToken(underlying);
}

/** An underlying's expiries and one expiry's options (the one asked for, or the nearest), loaded on demand. */
export function fetchOptionChain(_config: KiteConfig, _accessToken: string, underlying: Underlying, expiry: string | null, now: number): Promise<{ expiries: string[]; expiry: string | null; contracts: KiteContract[] }> {
  return gfdlChain(gfdlConfig(), underlying, expiry, now);
}

/** The option with this token, loading its expiry when this server hasn't yet. */
export function contractForToken(_config: KiteConfig, _accessToken: string, token: number, now: number): Promise<KiteContract | null> {
  return gfdlContractForToken(gfdlConfig(), token, now);
}

// ---------------------------------------------------------------------------------------------
// Kite, commented out while Global Datafeeds is the price feed (30 Oct 2026):
// ---------------------------------------------------------------------------------------------
// /**
//  * Kite Connect calls for the firm's Zerodha account (server only). One login serves every
//  * signed-in user, so quote and historical calls go through throttle.ts to stay inside Kite's
//  * limits: 1 quote request and 3 historical requests a second. Market data only: the same login
//  * can trade the firm's real account, so never add order, portfolio or funds calls here.
//  */
// import { LOOKBACK_DAYS, type Candle, type Interval } from "@/lib/market-data/candles";
// import type { Underlying } from "@/lib/trading/instruments";
// import { toIst } from "@/lib/trading/time";
// import type { KiteConfig } from "./config";
// import { createGate, createQuoteBatcher, createSharedLoads, type Gate } from "./throttle";
// import {
//   historicalPath,
//   historicalRanges,
//   KiteError,
//   kiteData,
//   mergeCandles,
//   parseCandles,
//   parseContracts,
//   parseLogin,
//   parseLtpTokens,
//   parseQuotes,
//   UNDERLYINGS,
//   type DerivativesExchange,
//   type KiteContract,
//   type KiteLogin,
//   type MarketQuote,
// } from "./kite";
// import { sessionChecksum } from "./session";
//
// /** Kite allows 1 quote request a second; a little over a second apart leaves room. */
// const QUOTE_GAP_MS = 1_050;
// /** 3 historical requests a second. */
// const HISTORY_GAP_MS = 350;
// /** A quote this recent is served from memory to the next screen that asks. */
// const QUOTE_FRESH_MS = 1_000;
// const QUOTE_MAX_KEYS = 500;
// /** How long chart history is reused for the next screen opening the same chart. */
// const HISTORY_KEEP_MS = 15_000;
// const DAY_HISTORY_KEEP_MS = 60_000;
//
// interface KiteThrottle {
//   quoteGate: Gate;
//   historyGate: Gate;
//   /** By access token: Kite issues a new one each day. */
//   quotes: Map<string, (keys: readonly string[]) => Promise<MarketQuote[]>>;
//   history: ReturnType<typeof createSharedLoads<Candle[]>>;
// }
//
// // On globalThis so every route in a server process shares one gate, however it was bundled.
// const shared = globalThis as unknown as { kiteThrottle?: KiteThrottle };
// const throttle = (shared.kiteThrottle ??= {
//   quoteGate: createGate(QUOTE_GAP_MS, 8),
//   historyGate: createGate(HISTORY_GAP_MS, 24),
//   quotes: new Map(),
//   history: createSharedLoads<Candle[]>(),
// });
//
// interface CallOptions {
//   accessToken?: string;
//   method?: "GET" | "POST" | "DELETE";
//   form?: Record<string, string>;
// }
//
// async function send(config: KiteConfig, path: string, options: CallOptions): Promise<Response> {
//   const headers: Record<string, string> = { "X-Kite-Version": "3" };
//   if (options.accessToken) headers.Authorization = `token ${config.apiKey}:${options.accessToken}`;
//   if (options.form) headers["Content-Type"] = "application/x-www-form-urlencoded";
//   try {
//     return await fetch(`${config.apiRoot}${path}`, {
//       method: options.method ?? "GET",
//       headers,
//       body: options.form ? new URLSearchParams(options.form) : undefined,
//       cache: "no-store",
//       signal: AbortSignal.timeout(20_000),
//     });
//   } catch {
//     throw new KiteError("The price feed could not be reached.", 504, "NetworkException");
//   }
// }
//
// async function failure(response: Response): Promise<KiteError> {
//   try {
//     kiteData(await response.json(), response.status);
//   } catch (error) {
//     if (error instanceof KiteError && error.errorType !== "DataException") return error;
//   }
//   const type = response.status === 429 ? "RateLimitException" : response.status === 403 ? "TokenException" : "GeneralException";
//   return new KiteError(`The price feed returned HTTP ${response.status}.`, response.status, type);
// }
//
// async function callJson(config: KiteConfig, path: string, options: CallOptions = {}): Promise<unknown> {
//   const response = await send(config, path, options);
//   if (!response.ok) throw await failure(response);
//   return response.json().catch(() => {
//     throw new KiteError("The price feed sent a response this app cannot read.", 502, "DataException");
//   });
// }
//
// /** Trade the one-time request token from the login redirect for the day's access token. */
// export async function createSession(config: KiteConfig, requestToken: string): Promise<KiteLogin> {
//   const checksum = sessionChecksum(config.apiKey, requestToken, config.apiSecret);
//   return parseLogin(await callJson(config, "/session/token", { method: "POST", form: { api_key: config.apiKey, request_token: requestToken, checksum } }));
// }
//
// /** Invalidate the access token at Kite. Kite web and mobile stay logged in. */
// export async function endSession(config: KiteConfig, accessToken: string): Promise<void> {
//   const query = new URLSearchParams({ api_key: config.apiKey, access_token: accessToken });
//   await callJson(config, `/session/token?${query}`, { method: "DELETE", accessToken });
// }
//
// /**
//  * The interval's lookback of candles up to `now`, with open interest for futures and options.
//  * Screens opening the same chart within a few seconds share one fetch.
//  */
// export function fetchCandles(config: KiteConfig, accessToken: string, instrumentToken: number, interval: Interval, withOi: boolean, now: number): Promise<Candle[]> {
//   const key = `${instrumentToken}|${interval}|${withOi ? "oi" : ""}`;
//   return throttle.history(key, interval === "day" ? DAY_HISTORY_KEEP_MS : HISTORY_KEEP_MS, async () => {
//     const lists: Candle[][] = [];
//     for (const [from, to] of historicalRanges(now - LOOKBACK_DAYS[interval] * 86_400_000, now, interval)) {
//       const path = historicalPath(instrumentToken, interval, from, to, withOi);
//       lists.push(parseCandles(await throttle.historyGate(() => callJson(config, path, { accessToken }))));
//     }
//     return mergeCandles(lists);
//   });
// }
//
// /** Quotes with five-level depth. The screens polling in the same second share one Kite call. */
// export function fetchQuotes(config: KiteConfig, accessToken: string, keys: readonly string[]): Promise<MarketQuote[]> {
//   let quotes = throttle.quotes.get(accessToken);
//   if (!quotes) {
//     // A new login: the old token's quotes go with it.
//     throttle.quotes.clear();
//     quotes = createQuoteBatcher({
//       load: async (wanted) => parseQuotes(await callJson(config, `/quote?${new URLSearchParams(wanted.map((key) => ["i", key]))}`, { accessToken }), Date.now()),
//       gate: throttle.quoteGate,
//       freshMs: QUOTE_FRESH_MS,
//       maxKeys: QUOTE_MAX_KEYS,
//     });
//     throttle.quotes.set(accessToken, quotes);
//   }
//   return quotes(keys);
// }
//
// // Kite's index tokens never change, and its instrument list changes once a day: keep both in
// // memory for this server instance.
// const indexTokens = new Map<Underlying, number>();
// const contractLists = new Map<string, Promise<KiteContract[]>>();
//
// export async function indexToken(config: KiteConfig, accessToken: string, underlying: Underlying): Promise<number> {
//   const known = indexTokens.get(underlying);
//   if (known) return known;
//   const keys = Object.values(UNDERLYINGS).map((item) => item.indexKey);
//   // /quote/ltp counts against the quote limit.
//   const body = await throttle.quoteGate(() => callJson(config, `/quote/ltp?${new URLSearchParams(keys.map((key) => ["i", key]))}`, { accessToken }));
//   const tokens = parseLtpTokens(body);
//   for (const [name, item] of Object.entries(UNDERLYINGS) as [Underlying, (typeof UNDERLYINGS)[Underlying]][]) {
//     const token = tokens.get(item.indexKey);
//     if (token) indexTokens.set(name, token);
//   }
//   const token = indexTokens.get(underlying);
//   if (!token) throw new KiteError(`The price feed did not return ${UNDERLYINGS[underlying].label}.`, 502, "DataException");
//   return token;
// }
//
// /** Today's NIFTY, BANK NIFTY or SENSEX futures and options on one exchange. */
// export function fetchContracts(config: KiteConfig, accessToken: string, exchange: DerivativesExchange, now: number): Promise<KiteContract[]> {
//   const cacheKey = `${exchange}:${toIst(now).date}`;
//   const cached = contractLists.get(cacheKey);
//   if (cached) return cached;
//   const loading = (async () => {
//     const response = await send(config, `/instruments/${exchange}`, { accessToken });
//     if (!response.ok) throw await failure(response);
//     return parseContracts(await response.text());
//   })();
//   for (const key of contractLists.keys()) if (key.startsWith(`${exchange}:`)) contractLists.delete(key);
//   contractLists.set(cacheKey, loading);
//   loading.catch(() => contractLists.delete(cacheKey));
//   return loading;
// }
