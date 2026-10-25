/**
 * Feeding market data into stored evaluation accounts (pure). The trading platform polls; each
 * poll fetches one batch of quotes, which becomes the engine's books for the account's contracts,
 * followed by a clock event that runs the 15:20 square-off and the 15:30 day close.
 */
import { deskQuoteKeys, deskStep, type Desk, type Exits } from "@/lib/trading/desk";
import { netQuantity, type EngineOutput, type OrderChanges, type OrderRequest } from "@/lib/trading/engine";
import { isOption, type Instrument, type Side } from "@/lib/trading/instruments";
import type { Quote } from "@/lib/trading/matching";
import { isQuoteKey, toEngineQuote, UNDERLYINGS, type MarketQuote } from "@/lib/zerodha/kite";

/**
 * Contracts per poll: the account's own, the charted option, the index for the money line and an
 * option chain. Still one quote call per poll (Kite takes up to 500 contracts a call), which keeps
 * us inside 1 request a second.
 */
export const MAX_TICK_KEYS = 40;

/** The account's contracts first (they drive fills and P&L), then what the screen is showing. */
export function tickKeys(desk: Desk, requested: readonly string[]): string[] {
  return [...new Set([...deskQuoteKeys(desk), ...requested.filter(isQuoteKey)])].slice(0, MAX_TICK_KEYS);
}

/**
 * Quotes for the browser: full depth for `focus` (the charted contract and the account's own), the
 * best bid and offer for the rest, which only fill the option chain.
 */
export function screenQuotes(quotes: readonly MarketQuote[], focus: ReadonlySet<string>): MarketQuote[] {
  return quotes.map((quote) => (focus.has(quote.key) ? quote : { ...quote, bids: quote.bids.slice(0, 1), asks: quote.asks.slice(0, 1) }));
}

/** Open units of a contract on a desk: positive long, negative short. */
function heldUnits(desk: Desk, token: number): number {
  const position = desk.state.positions.find((item) => item.instrument.token === token);
  return position ? netQuantity(position) : 0;
}

/** Whether a desk holds, or is working a buy for, options of `kind` on `underlying`. */
function holdsSide(desk: Desk, underlying: Instrument["underlying"], kind: "CE" | "PE"): boolean {
  const matches = (instrument: Instrument | undefined) => instrument?.underlying === underlying && instrument.kind === kind;
  return desk.state.positions.some((position) => matches(position.instrument) && netQuantity(position) > 0)
    || desk.state.orders.some((order) => order.side === "BUY" && matches(desk.instruments.find((item) => item.token === order.token)));
}

/**
 * The programme's trading policy, checked when an order is placed; the engine then checks the
 * rulebook. Directional bets on options only: buy a call or a put, and sell only to close what you
 * hold, so no short options and no spreads. Calls and puts on the same index can't be held
 * together, in one account or across the trader's `others` (no hedging). A futures position opened
 * before options-only can still be closed. Null when the order is fine.
 */
export function orderPolicyProblem(desk: Desk, instrument: Instrument, side: Side, lots: number, others: readonly Desk[] = []): string | null {
  const held = heldUnits(desk, instrument.token);
  const closing = held !== 0 && (side === "SELL") === (held > 0) && lots * instrument.lotSize <= Math.abs(held);
  if (!isOption(instrument)) return closing ? null : "Only options can be traded.";
  if (closing) return null;
  if (side === "SELL") return "Sell only to close an option you hold: short options aren't allowed.";
  const index = UNDERLYINGS[instrument.underlying].contractName;
  const kind = instrument.kind === "CE" ? "PE" : "CE";
  const theirs = kind === "PE" ? "puts" : "calls";
  const ours = kind === "PE" ? "calls" : "puts";
  if (holdsSide(desk, instrument.underlying, kind)) return `Directional bets only: you hold ${index} ${theirs}, so close them before buying ${ours}.`;
  if (others.some((other) => holdsSide(other, instrument.underlying, kind))) return `No hedging across accounts: another of your accounts holds ${index} ${theirs}.`;
  return null;
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

/** An order against a fresh quote for its contract, with a buy's stop-loss and target if it has them. */
export function applyOrder(desk: Desk, instrument: Instrument, order: OrderRequest, quotes: readonly MarketQuote[], now: number, exits?: Exits): { desk: Desk; outputs: EngineOutput[] } {
  const books = engineBooks(quotes);
  const quote = books.get(instrument.token);
  const marked = quote ? deskStep(desk, { kind: "quote", at: now, quote }, books, instrument).desk : desk;
  return deskStep(marked, { kind: "place", at: now, order }, books, instrument, exits);
}

/** Where an order is expected to fill, for checking its stop-loss and target: the last price, the limit or the trigger. */
export function expectedPrice(order: Pick<OrderRequest, "type" | "limitPrice" | "triggerPrice">, lastPrice: number | undefined): number | undefined {
  return order.type === "MARKET" ? lastPrice : order.type === "LIMIT" ? order.limitPrice : order.triggerPrice;
}

/** New terms for a working order against a fresh quote for its contract. */
export function applyModify(desk: Desk, orderId: string, changes: OrderChanges, quotes: readonly MarketQuote[], now: number): { desk: Desk; outputs: EngineOutput[] } {
  const books = engineBooks(quotes);
  const order = desk.state.orders.find((item) => item.id === orderId);
  const quote = order ? books.get(order.token) : undefined;
  const marked = quote ? deskStep(desk, { kind: "quote", at: now, quote }, books).desk : desk;
  return deskStep(marked, { kind: "modify", at: now, orderId, changes }, books);
}
