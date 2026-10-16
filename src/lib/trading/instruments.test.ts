import { describe, expect, it } from "vitest";
import { exposure, instrumentProblem, type Instrument } from "./instruments";

// Test fixtures, not exchange values: real lot, tick and freeze sizes come from the contract master.
const call = (token: number, strike: number, expiry = "2026-11-03"): Instrument => ({
  token, exchange: "NFO", tradingSymbol: `TEST-${strike}-CE`, underlying: "NIFTY", kind: "CE", expiry, strike, lotSize: 50, tickSize: 5, freezeQuantity: 900,
});
const put = (token: number, strike: number): Instrument => ({ ...call(token, strike), tradingSymbol: `TEST-${strike}-PE`, kind: "PE" });
const future: Instrument = { ...call(1, 0), tradingSymbol: "TEST-FUT", kind: "FUT", strike: null, expiry: "2026-11-24" };

describe("position exposure", () => {
  it("counts futures by absolute net lots", () => {
    expect(exposure([{ instrument: future, quantity: -100 }])).toEqual({ lots: 2, nakedShortLots: 0 });
  });

  it("counts a vertical spread as its long leg", () => {
    expect(exposure([{ instrument: call(2, 2_500_000), quantity: 50 }, { instrument: call(3, 2_510_000), quantity: -50 }])).toEqual({ lots: 1, nakedShortLots: 0 });
  });

  it("flags uncovered short options", () => {
    expect(exposure([{ instrument: call(2, 2_500_000), quantity: -50 }]).nakedShortLots).toBe(1);
    expect(exposure([{ instrument: call(2, 2_500_000), quantity: 50 }, { instrument: call(3, 2_510_000), quantity: -100 }]).nakedShortLots).toBe(1);
  });

  it("does not let a call cover a put or a different expiry cover a short", () => {
    expect(exposure([{ instrument: call(2, 2_500_000), quantity: 50 }, { instrument: put(4, 2_490_000), quantity: -50 }]).nakedShortLots).toBe(1);
    expect(exposure([{ instrument: call(2, 2_500_000, "2026-11-10"), quantity: 50 }, { instrument: call(3, 2_510_000), quantity: -50 }]).nakedShortLots).toBe(1);
  });

  it("validates contract-master rows", () => {
    expect(instrumentProblem(call(2, 2_500_000))).toBeNull();
    expect(instrumentProblem({ ...call(2, 2_500_000), strike: null })).toMatch(/strike/);
    expect(instrumentProblem({ ...future, strike: 100 })).toMatch(/strike/);
    expect(instrumentProblem({ ...future, lotSize: 0 })).toMatch(/lot size/);
    expect(instrumentProblem({ ...future, freezeQuantity: 10 })).toMatch(/freeze/);
  });
});
