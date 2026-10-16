/**
 * Fill logic for simulated orders against a quote's five-level depth (TRD SIM-3). Each simulated
 * account sees the full book; within one event an account's own fills use up depth.
 */
import type { Paise } from "./money";
import type { Side } from "./instruments";

export interface DepthLevel {
  price: Paise;
  /** Units available at this price. */
  quantity: number;
}

/** A normalised tick (TRD MD-2): last price and up to five levels a side, best first. */
export interface Quote {
  token: number;
  /** Engine receive time, epoch milliseconds. */
  at: number;
  lastPrice: Paise;
  bids: readonly DepthLevel[];
  asks: readonly DepthLevel[];
}

/** A mutable copy of a quote's book for one event. */
export interface Book {
  at: number;
  lastPrice: Paise;
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export function bookFrom(quote: Quote): Book {
  return {
    at: quote.at,
    lastPrice: quote.lastPrice,
    bids: quote.bids.map((level) => ({ ...level })),
    asks: quote.asks.map((level) => ({ ...level })),
  };
}

export interface Execution {
  price: Paise;
  quantity: number;
}

export interface WalkOptions {
  /** Worst acceptable price; null for a market order. */
  limit: Paise | null;
  /** Paise per unit added against the trader on market fills. */
  slippage: Paise;
  tick: Paise;
  /** Resting limit orders fill at their limit price when the market reaches it. */
  fillAtLimit: boolean;
}

/**
 * Take liquidity from the opposite side of the book, best level first, consuming what it uses.
 * Buys lift asks at or below the limit; sells hit bids at or above it. Market fills pay
 * `slippage` beyond each level's price (never below one tick for a sell).
 */
export function walkBook(side: Side, quantity: number, book: Book, options: WalkOptions): Execution[] {
  const levels = side === "BUY" ? book.asks : book.bids;
  const executions: Execution[] = [];
  let remaining = quantity;
  for (const level of levels) {
    if (remaining <= 0) break;
    if (level.quantity <= 0) continue;
    if (options.limit !== null && (side === "BUY" ? level.price > options.limit : level.price < options.limit)) break;
    const take = Math.min(remaining, level.quantity);
    let price = level.price;
    if (options.limit === null) price = side === "BUY" ? price + options.slippage : Math.max(options.tick, price - options.slippage);
    else if (options.fillAtLimit) price = options.limit;
    executions.push({ price, quantity: take });
    level.quantity -= take;
    remaining -= take;
  }
  return executions;
}

/**
 * A forced exit (square-off or breach) must close the whole quantity: walk the book as a market
 * order and fill any remainder at the last price reached, or at `fallback` with no depth at all.
 */
export function forceExecutions(side: Side, quantity: number, book: Book | null, fallback: Paise, slippage: Paise, tick: Paise): Execution[] {
  const executions = book ? walkBook(side, quantity, book, { limit: null, slippage, tick, fillAtLimit: false }) : [];
  const filled = executions.reduce((sum, execution) => sum + execution.quantity, 0);
  if (filled < quantity) {
    const price = executions.length > 0
      ? executions[executions.length - 1].price
      : side === "BUY" ? fallback + slippage : Math.max(tick, fallback - slippage);
    executions.push({ price, quantity: quantity - filled });
  }
  return executions;
}
