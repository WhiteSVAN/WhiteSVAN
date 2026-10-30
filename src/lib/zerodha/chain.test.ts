import { describe, expect, it } from "vitest";
import { MAX_TICK_KEYS } from "@/lib/accounts/ticks";
import { CHAIN_ROWS, chainWindow, DEFAULT_CHAIN_ROWS, isChainRows, MAX_SCREEN_KEYS, nearestStrike } from "./chain";
import type { OptionStrike } from "./kite";

const chain: OptionStrike[] = Array.from({ length: 60 }, (_, index) => ({ strike: (24_000 + index * 50) * 100, call: null, put: null }));
const strikes = (rows: readonly OptionStrike[]) => rows.map((row) => row.strike);

describe("option chain window", () => {
  it("shows the chosen number of strikes, half below the money", () => {
    const atm = chain[30].strike;
    for (const count of CHAIN_ROWS) {
      const rows = chainWindow(chain, atm, count);
      expect(rows).toHaveLength(count);
      expect(rows[count / 2].strike).toBe(atm);
    }
  });

  it("starts with the 10 rows around the money (more load when picked)", () => {
    expect(chainWindow(chain, chain[30].strike, DEFAULT_CHAIN_ROWS)).toHaveLength(10);
  });

  it("moves in from the ends of the chain", () => {
    expect(strikes(chainWindow(chain, chain[2].strike, 10))).toEqual(strikes(chain.slice(0, 10)));
    expect(strikes(chainWindow(chain, chain[58].strike, 10))).toEqual(strikes(chain.slice(50)));
  });

  it("centres on the strike nearest the index, or the middle before a price", () => {
    expect(nearestStrike(chain, (24_000 + 30 * 50 + 20) * 100)).toBe(chain[30].strike);
    expect(nearestStrike(chain, undefined)).toBe(chain[30].strike);
    expect(nearestStrike([], 1)).toBeNull();
  });

  it("accepts only the offered strike choices", () => {
    expect(CHAIN_ROWS.every(isChainRows)).toBe(true);
    expect(isChainRows(11)).toBe(false);
  });

  it("keeps the largest window inside one poll, with room for an account's own contracts", () => {
    const largest = 2 * Math.max(...CHAIN_ROWS) + 2;
    expect(largest).toBeLessThanOrEqual(MAX_SCREEN_KEYS);
    expect(largest + 20).toBeLessThanOrEqual(MAX_TICK_KEYS);
  });
});
