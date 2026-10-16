import { describe, expect, it } from "vitest";
import { PRACTICE_SCENARIOS, parsePracticeLimit, reviewPracticeDays } from "./academy-practice";

describe("synthetic classroom rule review", () => {
  it("counts equality as reaching a daily limit and retains it after recovery", () => {
    const result = reviewPracticeDays([-2000, 3000], 2000, 5000);
    expect(result.firstDailyBreach).toBe(1);
    expect(result.totalNetInr).toBe(1000);
    expect(result.firstDrawdownBreach).toBeNull();
  });

  it("measures drawdown from the initial virtual balance, not just the first close", () => {
    expect(reviewPracticeDays([-5000], 6000, 5000).firstDrawdownBreach).toBe(1);
  });

  it("detects cumulative EOD loss below the daily limit", () => {
    const result = reviewPracticeDays(PRACTICE_SCENARIOS[2].dailyNetInr, 2000, 5000);
    expect(result.firstDailyBreach).toBeNull();
    expect(result.firstDrawdownBreach).toBe(4);
    expect(result.maxDrawdownInr).toBe(5100);
  });

  it("uses the high-water closing balance and preserves the maximum after recovery", () => {
    const result = reviewPracticeDays([1000, -3000, 4000], 4000, 3000);
    expect(result.firstDrawdownBreach).toBe(2);
    expect(result.maxDrawdownInr).toBe(3000);
    expect(result.rows[2].drawdownInr).toBe(0);
  });

  it("compares rounded paise instead of floating-point sums", () => {
    const result = reviewPracticeDays([-0.1, -0.2], 1, 0.3);
    expect(result.totalNetInr).toBe(-0.3);
    expect(result.firstDrawdownBreach).toBe(2);
  });

  it("handles an empty example without inferring a pass", () => {
    expect(reviewPracticeDays([], 2000, 5000)).toMatchObject({ rows: [], totalNetInr: 0, firstDailyBreach: null, firstDrawdownBreach: null });
  });

  it("rejects missing, nonfinite, negative and out-of-range limits and P&L", () => {
    for (const value of [0, -1, NaN, Infinity, 100001, 1200.001]) {
      expect(() => reviewPracticeDays([], value, 5000)).toThrow();
    }
    expect(() => reviewPracticeDays([NaN], 2000, 5000)).toThrow();
  });

  it("accepts exact paise inputs and rejects extra precision without rounding a limit", () => {
    expect(parsePracticeLimit("1200.001")).toBeNull();
    expect(parsePracticeLimit("")).toBeNull();
    expect(parsePracticeLimit("1e3")).toBeNull();
    expect(parsePracticeLimit(".29")).toBe(0.29);
    expect(parsePracticeLimit("1200.01")).toBe(1200.01);
    expect(reviewPracticeDays([-1200], 1200.01, 5000).firstDailyBreach).toBeNull();
  });
});
