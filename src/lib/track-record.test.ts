import { describe, expect, it } from "vitest";
import { findEvaluationPlan } from "./prop-firm";
import { isProgrammeContract, reviewTrackRecord } from "./track-record";

// ₹1L plan: ₹6,000 target, ₹4,000 max loss, ₹2,000 daily loss, 5 days, 50% consistency.
const plan = findEvaluationPlan("1l")!;
const day = (date: string, rupees: number) => ({ date, net: rupees * 100 });
const PASSING = [
  day("2026-06-01", 1200),
  day("2026-06-02", 1500),
  day("2026-06-03", -600),
  day("2026-06-04", 1400),
  day("2026-06-05", 1300),
  day("2026-06-08", 1500),
  day("2026-06-09", 900),
];

describe("reviewTrackRecord", () => {
  it("passes on the day the target, the days and consistency are all met", () => {
    const review = reviewTrackRecord(plan, PASSING);
    expect(review.status).toBe("PASSED");
    expect(review.decidedOn).toBe("2026-06-08");
    expect(review.rows).toHaveLength(6); // the day after the pass isn't counted
    expect(review.profit).toBe(630_000);
    expect(review.worstDayLoss).toBe(60_000);
  });

  it("counts only days from the start, and a loss equal to the daily limit fails", () => {
    const review = reviewTrackRecord(plan, [day("2026-05-29", -5000), day("2026-06-01", 500), day("2026-06-02", -2000)], { start: "2026-06-01" });
    expect(review.status).toBe("FAILED");
    expect(review.decidedOn).toBe("2026-06-02");
    expect(review.rows.map((row) => row.date)).toEqual(["2026-06-01", "2026-06-02"]);
    expect(review.rows.at(-1)?.breaches).toEqual(["DAILY_LOSS"]);
  });

  it("fails when the trailing drawdown catches up without a daily-limit day", () => {
    const review = reviewTrackRecord(plan, [day("2026-06-01", 3000), day("2026-06-02", -1500), day("2026-06-03", -1500), day("2026-06-04", -1200)]);
    expect(review.status).toBe("FAILED");
    expect(review.rows.at(-1)).toMatchObject({ date: "2026-06-04", floor: 9_900_000, breaches: ["MAX_LOSS"] });
  });

  it("holds the pass while the best day is more than half the profit", () => {
    const review = reviewTrackRecord(plan, [day("2026-06-01", 4500), day("2026-06-02", 400), day("2026-06-03", 300), day("2026-06-04", 500), day("2026-06-05", 500)]);
    expect(review.status).toBe("ACTIVE");
    expect(review.targetLeft).toBe(0);
    expect(review.daysLeft).toBe(0);
    expect(review.consistencyMet).toBe(false);
    expect(review.profitForConsistency).toBe(900_000); // a ₹4,500 best day is half of ₹9,000
  });

  it("won't confirm a pass while a position has no closing trade", () => {
    const review = reviewTrackRecord(plan, PASSING, { openPositions: 1 });
    expect(review.status).toBe("ACTIVE");
    expect(review.passHeldOn).toBe("2026-06-08");
    expect(review.rows).toHaveLength(7);
  });

  it("starts at the plan's balance with nothing synced", () => {
    const review = reviewTrackRecord(plan, []);
    expect(review).toMatchObject({ status: "ACTIVE", balance: 10_000_000, floor: 9_600_000, targetLeft: 600_000, daysLeft: 5 });
  });
});

describe("isProgrammeContract", () => {
  it("keeps NIFTY, BANK NIFTY and SENSEX futures and options only", () => {
    expect(isProgrammeContract("NIFTY2660524750PE")).toBe(true);
    expect(isProgrammeContract("BANKNIFTY26JUNFUT")).toBe(true);
    expect(isProgrammeContract("SENSEX2660982000CE")).toBe(true);
    expect(isProgrammeContract("FINNIFTY26JUNFUT")).toBe(false);
    expect(isProgrammeContract("NIFTYNXT5026JUNFUT")).toBe(false);
    expect(isProgrammeContract("ESCORTS")).toBe(false);
  });
});
