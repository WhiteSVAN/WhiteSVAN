import { describe, expect, it } from "vitest";
import { MAX_TICK_KEYS } from "@/lib/accounts/ticks";
import { chainWindow, DEFAULT_STRIKES_EACH_SIDE, isStrikesEachSide, MAX_SCREEN_KEYS, nearestStrike, STRIKES_EACH_SIDE } from "./chain";
import type { OptionStrike } from "./kite";

const chain: OptionStrike[] = Array.from({ length: 60 }, (_, index) => ({ strike: (24_000 + index * 50) * 100, call: null, put: null }));
const strikes = (rows: readonly OptionStrike[]) => rows.map((row) => row.strike);

describe("option chain window", () => {
  it("shows the chosen number of strikes either side of the money", () => {
    const atm = chain[30].strike;
    for (const each of STRIKES_EACH_SIDE) {
      const rows = chainWindow(chain, atm, each);
      expect(rows).toHaveLength(2 * each + 1);
      expect(rows[each].strike).toBe(atm);
    }
  });

  it("starts with more than the old 11 rows", () => {
    expect(chainWindow(chain, chain[30].strike, DEFAULT_STRIKES_EACH_SIDE)).toHaveLength(21);
  });

  it("stops at the ends of the chain", () => {
    expect(strikes(chainWindow(chain, chain[2].strike, 10))).toEqual(strikes(chain.slice(0, 13)));
    expect(strikes(chainWindow(chain, chain[58].strike, 10))).toEqual(strikes(chain.slice(48)));
  });

  it("centres on the strike nearest the index, or the middle before a price", () => {
    expect(nearestStrike(chain, (24_000 + 30 * 50 + 20) * 100)).toBe(chain[30].strike);
    expect(nearestStrike(chain, undefined)).toBe(chain[30].strike);
    expect(nearestStrike([], 1)).toBeNull();
  });

  it("accepts only the offered strike choices", () => {
    expect(STRIKES_EACH_SIDE.every(isStrikesEachSide)).toBe(true);
    expect(isStrikesEachSide(7)).toBe(false);
  });

  it("keeps the largest window inside one poll, with room for an account's own contracts", () => {
    const largest = 2 * (2 * Math.max(...STRIKES_EACH_SIDE) + 1) + 2;
    expect(largest).toBeLessThanOrEqual(MAX_SCREEN_KEYS);
    expect(largest + 20).toBeLessThanOrEqual(MAX_TICK_KEYS);
  });
});
