/**
 * Zerodha Kite Connect v3: request building and response parsing for the firm's Zerodha account,
 * whose login serves every signed-in user's charts and trading platform (CLAUDE.md, "Zerodha
 * charts"). Pure: no environment, network or clock; client.ts makes the calls, session.ts and
 * connection.ts handle the login.
 */
import type { Candle, Interval } from "@/lib/market-data/candles";
import type { Instrument, InstrumentKind, Underlying } from "@/lib/trading/instruments";
import type { DepthLevel, Quote } from "@/lib/trading/matching";
import type { Paise } from "@/lib/trading/money";
import { toIst } from "@/lib/trading/time";

export const KITE_API_ROOT = "https://api.kite.trade";
export const KITE_LOGIN_URL = "https://kite.zerodha.com/connect/login";

export type DerivativesExchange = "NFO" | "BFO";

/**
 * Each underlying's index (label and Kite quote key), the name its contracts go by, and the exchange
 * its futures and options trade on.
 */
export const UNDERLYINGS: Record<Underlying, { label: string; contractName: string; indexKey: string; exchange: DerivativesExchange }> = {
  NIFTY: { label: "NIFTY 50", contractName: "NIFTY", indexKey: "NSE:NIFTY 50", exchange: "NFO" },
  BANKNIFTY: { label: "BANK NIFTY", contractName: "BANK NIFTY", indexKey: "NSE:NIFTY BANK", exchange: "NFO" },
  SENSEX: { label: "SENSEX", contractName: "SENSEX", indexKey: "BSE:SENSEX", exchange: "BFO" },
};

export const isUnderlying = (value: string): value is Underlying => Object.hasOwn(UNDERLYINGS, value);

/** Quote keys this app asks Kite for: an index, or one of its futures and options contracts. */
export const isQuoteKey = (value: string) => /^(?:NSE|BSE|NFO|BFO):[A-Z0-9][A-Z0-9 &-]{0,39}$/.test(value);

export class KiteError extends Error {
  readonly status: number;
  /** Kite's exception name, such as TokenException or InputException. */
  readonly errorType: string;

  constructor(message: string, status: number, errorType: string) {
    super(message);
    this.name = "KiteError";
    this.status = status;
    this.errorType = errorType;
  }

  /** The access token expired (06:00 IST) or was revoked, so the owner must log in again. */
  get sessionEnded(): boolean {
    return this.status === 403 || this.errorType === "TokenException";
  }
}

const dataError = (what: string) => new KiteError(`The price feed sent ${what} this app cannot read.`, 502, "DataException");

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

/** The `data` of Kite's success envelope; throws a KiteError for an error envelope or anything else. */
export function kiteData(body: unknown, status = 200): unknown {
  if (isObject(body) && body.status === "success" && "data" in body) return body.data;
  if (isObject(body) && body.status === "error") {
    throw new KiteError(typeof body.message === "string" ? body.message : "The price feed returned an error.", status, typeof body.error_type === "string" ? body.error_type : "GeneralException");
  }
  throw dataError("a response");
}

/** Login page URL. Kite sends `redirect_params` back to the app's redirect URL with the request token. */
export function loginUrl(apiKey: string, state: string, base = KITE_LOGIN_URL): string {
  const url = new URL(base);
  url.searchParams.set("v", "3");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("redirect_params", new URLSearchParams({ state }).toString());
  return url.toString();
}

export interface KiteLogin {
  /** Zerodha client ID, such as AB1234. */
  userId: string;
  userName: string;
  accessToken: string;
}

export function parseLogin(body: unknown): KiteLogin {
  const data = kiteData(body);
  if (!isObject(data) || typeof data.user_id !== "string" || typeof data.access_token !== "string" || !data.access_token) throw dataError("a login");
  return { userId: data.user_id, userName: typeof data.user_name === "string" ? data.user_name : data.user_id, accessToken: data.access_token };
}

/** A Kite price (rupees) in paise. Prices sit on 0.05 or 0.01 ticks, so rounding only removes float noise. */
export function feedPaise(value: unknown): Paise {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e10) throw dataError(`a price (${String(value)})`);
  return Math.round(value * 100);
}

/** Volume, open interest or order counts: whole and non-negative. */
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw dataError(`a quantity (${String(value)})`);
  return Math.round(value);
}

/** Kite times: `2026-10-16T09:15:00+0530` (candles) or `2026-10-16 15:29:59` (quotes, IST). */
export function kiteTime(value: unknown): number {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:([+-])(\d{2}):?(\d{2}))?$/.exec(value) : null;
  if (!match) throw dataError(`a time (${String(value)})`);
  const [, year, month, day, hour, minute, second, sign, offsetHours, offsetMinutes] = match;
  const offset = sign ? (sign === "+" ? 1 : -1) * (Number(offsetHours) * 60 + Number(offsetMinutes)) : 330;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) - offset * 60_000;
}

/** `from`/`to` for historical requests: IST wall-clock `YYYY-MM-DD HH:MM:SS`. */
export function kiteDateTime(at: number): string {
  const { date, second } = toIst(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date} ${pad(Math.floor(second / 3600))}:${pad(Math.floor(second / 60) % 60)}:${pad(second % 60)}`;
}

/** Longest range Kite serves in one historical request, in days; longer ranges are split. */
const MAX_RANGE_DAYS: Record<Interval, number> = {
  minute: 60,
  "3minute": 100,
  "5minute": 100,
  "10minute": 100,
  "15minute": 200,
  "30minute": 200,
  "60minute": 400,
  day: 2000,
};

export function historicalRanges(from: number, to: number, interval: Interval): [number, number][] {
  const step = MAX_RANGE_DAYS[interval] * 86_400_000;
  const ranges: [number, number][] = [];
  for (let start = from; start < to; start += step) ranges.push([start, Math.min(to, start + step)]);
  return ranges;
}

export function historicalPath(instrumentToken: number, interval: Interval, from: number, to: number, withOi: boolean): string {
  const query = new URLSearchParams({ from: kiteDateTime(from), to: kiteDateTime(to) });
  if (withOi) query.set("oi", "1");
  return `/instruments/historical/${instrumentToken}/${interval}?${query}`;
}

/** Candle rows `[time, open, high, low, close, volume, oi?]` from GET /instruments/historical. */
export function parseCandles(body: unknown): Candle[] {
  const data = kiteData(body);
  const rows = isObject(data) ? data.candles : undefined;
  if (!Array.isArray(rows)) throw dataError("candles");
  return rows.map((row: unknown) => {
    if (!Array.isArray(row) || row.length < 6) throw dataError("a candle");
    return {
      at: kiteTime(row[0]),
      open: feedPaise(row[1]),
      high: feedPaise(row[2]),
      low: feedPaise(row[3]),
      close: feedPaise(row[4]),
      volume: count(row[5]),
      oi: row.length > 6 ? count(row[6]) : null,
    };
  });
}

/** Several requests' candles in time order, one per start time (adjacent ranges share an edge). */
export function mergeCandles(lists: readonly Candle[][]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const list of lists) for (const candle of list) byTime.set(candle.at, candle);
  return [...byTime.values()].sort((a, b) => a.at - b.at);
}

export interface DepthRow extends DepthLevel {
  orders: number;
}

export interface MarketQuote {
  /** Kite key, `exchange:tradingsymbol`. */
  key: string;
  token: number;
  /** Exchange time of the quote, UTC epoch ms. */
  at: number;
  lastTradeAt: number | null;
  lastPrice: Paise;
  /** Previous trading day's close (Kite's `ohlc.close`). */
  previousClose: Paise;
  open: Paise;
  high: Paise;
  low: Paise;
  /** Units traded today; 0 for an index. */
  volume: number;
  /** Open interest for futures and options; null for an index. */
  oi: number | null;
  /** Up to five levels a side, best first; empty for an index. */
  bids: DepthRow[];
  asks: DepthRow[];
}

function depthRows(rows: unknown): DepthRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(isObject)
    .map((row) => ({ price: feedPaise(row.price), quantity: count(row.quantity), orders: count(row.orders ?? 0) }))
    .filter((row) => row.price > 0 && row.quantity > 0);
}

/** GET /quote. `receivedAt` stands in for an index quote without an exchange timestamp. */
export function parseQuotes(body: unknown, receivedAt: number): MarketQuote[] {
  const data = kiteData(body);
  if (!isObject(data)) throw dataError("quotes");
  return Object.entries(data).map(([key, raw]) => {
    if (!isObject(raw) || typeof raw.instrument_token !== "number") throw dataError("a quote");
    const ohlc = isObject(raw.ohlc) ? raw.ohlc : {};
    const depth = isObject(raw.depth) ? raw.depth : {};
    const derivative = key.startsWith("NFO:") || key.startsWith("BFO:");
    return {
      key,
      token: raw.instrument_token,
      at: raw.timestamp ? kiteTime(raw.timestamp) : receivedAt,
      lastTradeAt: raw.last_trade_time ? kiteTime(raw.last_trade_time) : null,
      lastPrice: feedPaise(raw.last_price),
      previousClose: feedPaise(ohlc.close ?? 0),
      open: feedPaise(ohlc.open ?? 0),
      high: feedPaise(ohlc.high ?? 0),
      low: feedPaise(ohlc.low ?? 0),
      volume: count(raw.volume ?? 0),
      oi: derivative ? count(raw.oi ?? 0) : null,
      bids: depthRows(depth.buy),
      asks: depthRows(depth.sell),
    };
  });
}

/** A Kite quote as the trading core's normalised tick (TRD MD-2), for simulated fills. */
export function toEngineQuote(quote: MarketQuote, receivedAt: number): Quote {
  const level = ({ price, quantity }: DepthRow): DepthLevel => ({ price, quantity });
  return { token: quote.token, at: receivedAt, lastPrice: quote.lastPrice, bids: quote.bids.map(level), asks: quote.asks.map(level) };
}

/** Instrument tokens from GET /quote/ltp, by quote key. */
export function parseLtpTokens(body: unknown): Map<string, number> {
  const data = kiteData(body);
  if (!isObject(data)) throw dataError("prices");
  const tokens = new Map<string, number>();
  for (const [key, raw] of Object.entries(data)) {
    if (isObject(raw) && typeof raw.instrument_token === "number") tokens.set(key, raw.instrument_token);
  }
  return tokens;
}

/** A NIFTY, BANK NIFTY or SENSEX future or option from Kite's instrument list. */
export interface KiteContract {
  token: number;
  exchange: DerivativesExchange;
  tradingSymbol: string;
  underlying: Underlying;
  kind: InstrumentKind;
  /** IST date, `YYYY-MM-DD`. */
  expiry: string;
  strike: Paise | null;
  lotSize: number;
  tickSize: Paise;
}

export const quoteKey = (contract: Pick<KiteContract, "exchange" | "tradingSymbol">) => `${contract.exchange}:${contract.tradingSymbol}`;

/**
 * A Kite contract as the trading engine's instrument. Kite's instrument list has no freeze
 * quantity; every plan's lot limit (8 lots at most) sits far below the exchanges' index freeze
 * limits, so the freeze check stays open until the contract master (S1-10) loads the exchange
 * file. The plan's lot limit still applies.
 */
export const contractInstrument = (contract: KiteContract): Instrument => ({ ...contract, freezeQuantity: Number.MAX_SAFE_INTEGER });

/** One CSV line; handles double-quoted fields in case a name ever contains a comma. */
function csvFields(line: string): string[] {
  if (!line.includes('"')) return line.split(",");
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { fields.push(field); field = ""; }
    else field += char;
  }
  fields.push(field);
  return fields;
}

const KINDS = new Set<string>(["FUT", "CE", "PE"]);
const UNDERLYING_FIELD = /,"?(NIFTY|BANKNIFTY|SENSEX)"?,/;

/** Futures and options on our three underlyings from GET /instruments/NFO or /instruments/BFO (CSV). */
export function parseContracts(csv: string): KiteContract[] {
  const lines = csv.split(/\r?\n/);
  const header = csvFields(lines[0] ?? "").map((name) => name.trim());
  const column = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw dataError(`an instrument list without a ${name} column`);
    return index;
  };
  const at = {
    token: column("instrument_token"), symbol: column("tradingsymbol"), name: column("name"), expiry: column("expiry"),
    strike: column("strike"), tick: column("tick_size"), lot: column("lot_size"), kind: column("instrument_type"), exchange: column("exchange"),
  };
  const contracts: KiteContract[] = [];
  for (const line of lines.slice(1)) {
    if (!UNDERLYING_FIELD.test(line)) continue;
    const fields = csvFields(line);
    const name = fields[at.name];
    const kind = fields[at.kind];
    const exchange = fields[at.exchange];
    if (!isUnderlying(name) || !KINDS.has(kind) || exchange !== UNDERLYINGS[name].exchange) continue;
    const token = Number(fields[at.token]);
    const lotSize = Number(fields[at.lot]);
    const tickSize = Math.round(Number(fields[at.tick]) * 100);
    const strike = kind === "FUT" ? null : Math.round(Number(fields[at.strike]) * 100);
    const expiry = fields[at.expiry];
    const valid = Number.isSafeInteger(token) && token > 0 && Number.isSafeInteger(lotSize) && lotSize > 0 && tickSize > 0
      && /^\d{4}-\d{2}-\d{2}$/.test(expiry) && (strike === null || (Number.isSafeInteger(strike) && strike > 0));
    if (!valid) throw dataError(`an instrument row (${fields[at.symbol]})`);
    contracts.push({ token, exchange: UNDERLYINGS[name].exchange, tradingSymbol: fields[at.symbol], underlying: name, kind: kind as InstrumentKind, expiry, strike, lotSize, tickSize });
  }
  return contracts;
}

export interface OptionStrike {
  strike: Paise;
  call: KiteContract | null;
  put: KiteContract | null;
}

/** An underlying's futures by expiry, its option expiries, and the strikes for one expiry. */
export function contractsFor(contracts: readonly KiteContract[], underlying: Underlying, today: string) {
  const live = contracts.filter((contract) => contract.underlying === underlying && contract.expiry >= today);
  const futures = live.filter((contract) => contract.kind === "FUT").sort((a, b) => a.expiry.localeCompare(b.expiry));
  const options = live.filter((contract) => contract.kind !== "FUT");
  const expiries = [...new Set(options.map((contract) => contract.expiry))].sort();
  const chain = (expiry: string): OptionStrike[] => {
    const strikes = new Map<number, OptionStrike>();
    for (const contract of options) {
      if (contract.expiry !== expiry || contract.strike === null) continue;
      const row = strikes.get(contract.strike) ?? { strike: contract.strike, call: null, put: null };
      if (contract.kind === "CE") row.call = contract;
      else row.put = contract;
      strikes.set(contract.strike, row);
    }
    return [...strikes.values()].sort((a, b) => a.strike - b.strike);
  };
  return { futures, expiries, chain };
}

/** What /api/zerodha/instruments returns for one underlying: its options, and its index for the money line. */
export interface InstrumentList {
  underlying: Underlying;
  index: { key: string; token: number; label: string };
  expiries: string[];
  /** The expiry `chain` lists: the one asked for, or the nearest. */
  expiry: string | null;
  chain: OptionStrike[];
}
