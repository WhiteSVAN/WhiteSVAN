/**
 * Feeding market data into stored evaluation accounts (pure). The trading platform polls; each
 * poll fetches one batch of quotes, which becomes the engine's books for the account's contracts,
 * followed by a clock event that runs the 15:20 square-off and the 15:30 day close.
 */
import { deskQuoteKeys, deskStep, type Desk } from "@/lib/trading/desk";
import type { EngineOutput, OrderRequest } from "@/lib/trading/engine";
import type { Instrument } from "@/lib/trading/instruments";
import type { Quote } from "@/lib/trading/matching";
import { isQuoteKey, toEngineQuote, type MarketQuote } from "@/lib/zerodha/kite";

/** Kite's limit per /quote call is far higher, but one call per poll keeps us inside 1 request a second. */
export const MAX_TICK_KEYS = 8;

/** The account's contracts first (they drive fills and P&L), then what the screen is showing. */
export function tickKeys(desk: Desk, requested: readonly string[]): string[] {
  return [...new Set([...deskQuoteKeys(desk), ...requested.filter(isQuoteKey)])].slice(0, MAX_TICK_KEYS);
}

/** Futures and options quotes as engine books, stamped with the exchange's quote time so a stalled feed reads as stale. */
export function engineBooks(quotes: readonly MarketQuote[]): Map<number, Quote> {
  return new Map(quotes.filter((quote) => /^(?:NFO|BFO):/.test(quote.key)).map((quote) => [quote.token, toEngineQuote(quote, quote.at)]));
}

export function applyTick(desk: Desk, quotes: readonly MarketQuote[], now: number): Desk {
  const books = engineBooks(quotes);
  const held = new Set(desk.instruments.map((instrument) => instrument.token));
  let next = desk;
  for (const [token, quote] of books) {
    if (held.has(token)) next = deskStep(next, { kind: "quote", at: now, quote }, books).desk;
  }
  return deskStep(next, { kind: "clock", at: now }, books).desk;
}

export function applyOrder(desk: Desk, instrument: Instrument, order: OrderRequest, quotes: readonly MarketQuote[], now: number): { desk: Desk; outputs: EngineOutput[] } {
  const books = engineBooks(quotes);
  const quote = books.get(instrument.token);
  const marked = quote ? deskStep(desk, { kind: "quote", at: now, quote }, books, instrument).desk : desk;
  return deskStep(marked, { kind: "place", at: now, order }, books, instrument);
}
