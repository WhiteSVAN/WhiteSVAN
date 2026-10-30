/**
 * The option chain's window around the money (pure): how many strikes the trading screen offers,
 * and how many quote keys one screen may poll. The screen and the quote routes share these, so the
 * largest window always fits in one poll.
 */
import type { OptionStrike } from "./kite";

/** Strikes the chain can show around the money: 10, 20, 30 or 40 rows. */
export const CHAIN_ROWS = [10, 20, 30, 40] as const;
export type ChainRows = (typeof CHAIN_ROWS)[number];
/** 10 rows to start, so a chain prices only the strikes around the money; picking 20, 30 or 40 loads the rest. */
export const DEFAULT_CHAIN_ROWS: ChainRows = 10;
export const isChainRows = (value: number): value is ChainRows => (CHAIN_ROWS as readonly number[]).includes(value);

/**
 * Most quote keys a screen without an account polls: a call and a put for each row of the largest
 * window (80), the index for the money line and the ticket's option, with room to spare. Kite takes
 * up to 500 a call, and screens polling together still share one call a second.
 */
export const MAX_SCREEN_KEYS = 100;

/** The strike nearest the index (the money), or the chain's middle before the index has a price. */
export function nearestStrike(chain: readonly OptionStrike[], target: number | undefined): number | null {
  if (chain.length === 0) return null;
  if (target === undefined) return chain[Math.floor(chain.length / 2)].strike;
  return chain.reduce((best, row) => (Math.abs(row.strike - target) < Math.abs(best - target) ? row.strike : best), chain[0].strike);
}

/** `rows` strikes around the money: half below the money strike, then it and the rest above; moved in from the chain's ends. */
export function chainWindow(chain: readonly OptionStrike[], atm: number | null, rows: number): OptionStrike[] {
  const middle = Math.max(0, chain.findIndex((row) => row.strike === atm));
  const start = Math.max(0, Math.min(middle - Math.floor(rows / 2), chain.length - rows));
  return chain.slice(start, start + rows);
}
