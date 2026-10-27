/**
 * The option chain's window around the money (pure): how many strikes the trading screen offers,
 * and how many quote keys one screen may poll. The screen and the quote routes share these, so the
 * largest window always fits in one poll.
 */
import type { OptionStrike } from "./kite";

/** Strikes either side of the money the screen can show: 11, 21, 31 or 41 rows. */
export const STRIKES_EACH_SIDE = [5, 10, 15, 20] as const;
export type StrikesEachSide = (typeof STRIKES_EACH_SIDE)[number];
/** 21 rows to start; the chain scrolls, with the money row in the middle. */
export const DEFAULT_STRIKES_EACH_SIDE: StrikesEachSide = 10;
export const isStrikesEachSide = (value: number): value is StrikesEachSide => (STRIKES_EACH_SIDE as readonly number[]).includes(value);

/**
 * Most quote keys a screen without an account polls: a call and a put for each row of the largest
 * window (82), the index for the money line and the ticket's option, with room to spare. Kite takes
 * up to 500 a call, and screens polling together still share one call a second.
 */
export const MAX_SCREEN_KEYS = 100;

/** The strike nearest the index (the money), or the chain's middle before the index has a price. */
export function nearestStrike(chain: readonly OptionStrike[], target: number | undefined): number | null {
  if (chain.length === 0) return null;
  if (target === undefined) return chain[Math.floor(chain.length / 2)].strike;
  return chain.reduce((best, row) => (Math.abs(row.strike - target) < Math.abs(best - target) ? row.strike : best), chain[0].strike);
}

/** The chain's rows from `eachSide` strikes below the money to `eachSide` above, cut short at the chain's ends. */
export function chainWindow(chain: readonly OptionStrike[], atm: number | null, eachSide: number): OptionStrike[] {
  const middle = Math.max(0, chain.findIndex((row) => row.strike === atm));
  return chain.slice(Math.max(0, middle - eachSide), middle + eachSide + 1);
}
