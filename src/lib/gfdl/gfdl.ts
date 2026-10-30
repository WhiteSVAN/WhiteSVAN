/**
 * Global Datafeeds WebSocket API: request building and response parsing into the shapes the Kite
 * code already serves (contracts, quotes, candles), so the routes and screens don't change. Pure:
 * feed.ts holds the connection.
 *
 * GFDL has no index prices on a derivatives key, so each index is stood in for by its near-month
 * future (`SENSEX-I`), under the index's own quote key. Quotes carry the best bid and offer only.
 */
import { LOOKBACK_DAYS, type Candle, type Interval } from "@/lib/market-data/candles";
import type { Underlying } from "@/lib/trading/instruments";
import type { Paise } from "@/lib/trading/money";
import { toIst } from "@/lib/trading/time";
import { isQuoteKey, KiteError, UNDERLYINGS, type DerivativesExchange, type KiteContract, type MarketQuote } from "@/lib/zerodha/kite";

/** Index options' instrument type on each exchange (BSE names them IO, NSE OPTIDX). */
export const OPTION_TYPE: Record<DerivativesExchange, string> = { NFO: "OPTIDX", BFO: "IO" };

/** GFDL's product for each underlying, the future that stands in for its index, and a token for that stand-in. */
export const GFDL_INDEX: Record<Underlying, { product: string; identifier: string; token: number }> = {
  NIFTY: { product: "NIFTY", identifier: "NIFTY-I", token: 9_000_000_001 },
  BANKNIFTY: { product: "BANKNIFTY", identifier: "BANKNIFTY-I", token: 9_000_000_002 },
  SENSEX: { product: "SENSEX", identifier: "SENSEX-I", token: 9_000_000_003 },
};

/** GFDL's instrument list has no tick size; index options tick in 5 paise on both exchanges. */
const OPTION_TICK: Paise = 5;

/** GFDL keeps 60-odd days of intraday candles. */
const MAX_INTRADAY_DAYS = 60;

const PERIODS: Record<Interval, [periodicity: string, period: number]> = {
  minute: ["MINUTE", 1],
  "3minute": ["MINUTE", 3],
  "5minute": ["MINUTE", 5],
  "10minute": ["MINUTE", 10],
  "15minute": ["MINUTE", 15],
  "30minute": ["MINUTE", 30],
  "60minute": ["HOUR", 1],
  day: ["DAY", 1],
};

type Json = Record<string, unknown>;
export const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

const dataError = (what: string) => new KiteError(`The price feed sent ${what} this app cannot read.`, 502, "DataException");

/** A GFDL contract: Kite's shape, plus GFDL's identifier (`IO_SENSEX_05NOV2026_CE_75000`). */
export interface GfdlContract extends KiteContract {
  identifier: string;
}

const MONTHS: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

/** `05Nov2026` or `05NOV2026` as `2026-11-05`. */
export function gfdlDate(value: unknown): string {
  const match = typeof value === "string" ? /^(\d{2})([A-Za-z]{3})(\d{4})$/.exec(value) : null;
  const month = match ? MONTHS[match[2].toUpperCase()] : undefined;
  if (!match || !month) throw dataError(`an expiry (${String(value)})`);
  return `${match[3]}-${month}-${match[1]}`;
}

function price(value: unknown): Paise {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e10) throw dataError(`a price (${String(value)})`);
  return Math.round(value * 100);
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/** The `Result` array of a GFDL reply. */
export function results(body: unknown, what: string): Json[] {
  const rows = isObject(body) ? body.Result : undefined;
  if (!Array.isArray(rows)) throw dataError(what);
  return rows.filter(isObject);
}

export function instrumentsRequest(exchange: DerivativesExchange, underlying: Underlying, expiry?: string) {
  return { MessageType: "GetInstruments", Exchange: exchange, InstrumentType: OPTION_TYPE[exchange], Product: GFDL_INDEX[underlying].product, ...(expiry ? { Expiry: expiry } : {}), DetailedInfo: "true" };
}

export function expiriesRequest(exchange: DerivativesExchange, underlying: Underlying) {
  return { MessageType: "GetExpiryDates", Exchange: exchange, InstrumentType: OPTION_TYPE[exchange], Product: GFDL_INDEX[underlying].product };
}

/** The `count` nearest option expiries from `today` (IST, `YYYY-MM-DD`), in GFDL's own spelling (`05NOV2026`). */
export function nearestExpiries(body: unknown, today: string, count: number): string[] {
  return results(body, "expiries")
    .map((row) => String(row.Value))
    .filter((value) => /^\d{2}[A-Za-z]{3}\d{4}$/.test(value) && gfdlDate(value) >= today)
    .sort((a, b) => gfdlDate(a).localeCompare(gfdlDate(b)))
    .slice(0, count);
}

/** One underlying's options from GetInstruments (DetailedInfo, for the exchange token). Throws only when the reply isn't a list. */
export function parseGfdlContracts(body: unknown, exchange: DerivativesExchange, underlying: Underlying): GfdlContract[] {
  const contracts: GfdlContract[] = [];
  for (const row of results(body, "an instrument list")) {
    const kind = row.OptionType;
    if (kind !== "CE" && kind !== "PE") continue;
    const token = Number(row.TokenNumber);
    const lotSize = Math.round(Number(row.QuotationLot));
    const strike = Math.round(Number(row.StrikePrice) * 100);
    const tradingSymbol = String(row.Series || row.Description || row.TradeSymbol || "");
    const identifier = String(row.Identifier ?? "");
    // A row this app can't trade (no token, an odd symbol) is left out rather than failing the list.
    if (!Number.isSafeInteger(token) || token <= 0 || !Number.isSafeInteger(lotSize) || lotSize <= 0 || !Number.isSafeInteger(strike) || strike <= 0 || !identifier || !isQuoteKey(`${exchange}:${tradingSymbol}`)) continue;
    contracts.push({ token, exchange, tradingSymbol, underlying, kind, expiry: gfdlDate(row.Expiry), strike, lotSize, tickSize: OPTION_TICK, identifier });
  }
  return contracts;
}

/**
 * A RealtimeResult or LastQuoteResult as Kite's quote. `index` marks the future standing in for an
 * index: it reads like an index quote (no depth, volume or open interest). `at` is when the price
 * reached us, so a feed that stops pushing reads as stale.
 */
export function gfdlQuote(raw: Json, key: string, token: number, index: boolean, at: number): MarketQuote {
  const side = (priceField: unknown, quantityField: unknown) => {
    const level = { price: price(priceField ?? 0), quantity: count(quantityField), orders: 0 };
    return !index && level.price > 0 && level.quantity > 0 ? [level] : [];
  };
  return {
    key,
    token,
    at,
    lastTradeAt: typeof raw.LastTradeTime === "number" && raw.LastTradeTime > 0 ? raw.LastTradeTime * 1000 : null,
    lastPrice: price(raw.LastTradePrice ?? 0),
    previousClose: price(raw.Close ?? 0),
    open: price(raw.Open ?? 0),
    high: price(raw.High ?? 0),
    low: price(raw.Low ?? 0),
    volume: index ? 0 : count(raw.TotalQtyTraded),
    oi: index ? null : count(raw.OpenInterest),
    bids: side(raw.BuyPrice, raw.BuyQty),
    asks: side(raw.SellPrice, raw.SellQty),
  };
}

/** GetHistory for the interval's lookback up to `now` (epoch seconds in the request). */
export function historyRequest(exchange: DerivativesExchange, identifier: string, interval: Interval, now: number) {
  const [periodicity, period] = PERIODS[interval];
  const days = interval === "day" ? LOOKBACK_DAYS[interval] : Math.min(LOOKBACK_DAYS[interval], MAX_INTRADAY_DAYS);
  return {
    MessageType: "GetHistory",
    Exchange: exchange,
    InstrumentIdentifier: identifier,
    Periodicity: periodicity,
    Period: period,
    From: Math.floor((now - days * 86_400_000) / 1000),
    To: Math.floor(now / 1000),
    isShortIdentifier: "false",
  };
}

/** IST midnight of the IST date `at` falls on. */
function istMidnight(at: number): number {
  const [year, month, day] = toIst(at).date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) - 330 * 60_000;
}

/** HistoryOHLCResult rows (newest first, `LastTradeTime` the candle's start) as candles in time order. */
export function parseGfdlCandles(body: unknown, interval: Interval, withOi: boolean): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const row of results(body, "candles")) {
    if (typeof row.LastTradeTime !== "number") throw dataError("a candle");
    const start = row.LastTradeTime * 1000;
    const at = interval === "day" ? istMidnight(start) : start;
    byTime.set(at, {
      at,
      open: price(row.Open),
      high: price(row.High),
      low: price(row.Low),
      close: price(row.Close),
      volume: count(row.TradedQty),
      oi: withOi ? count(row.OpenInterest) : null,
    });
  }
  return [...byTime.values()].sort((a, b) => a.at - b.at);
}

/** The underlying whose index quote key this is (`BSE:SENSEX`), if it is one. */
export function indexUnderlying(key: string): Underlying | null {
  for (const [name, item] of Object.entries(UNDERLYINGS) as [Underlying, (typeof UNDERLYINGS)[Underlying]][]) {
    if (item.indexKey === key) return name;
  }
  return null;
}
