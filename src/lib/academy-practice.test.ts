import { describe, expect, it } from "vitest";
import { MAX_PRACTICE_DAYS, PRACTICE_SCENARIOS, parsePracticeAmount, reviewPracticeWeek, scenarioAmounts } from "./academy-practice";
import { EVALUATION_PLANS, findEvaluationPlan } from "./prop-firm";

const oneLakh = findEvaluationPlan("1l")!;
const scenario = (id: string) => PRACTICE_SCENARIOS.find((item) => item.id === id)!;
const run = (id: string, plan = oneLakh) => reviewPracticeWeek(plan, scenarioAmounts(scenario(id), plan));
const r = (rupees: number) => rupees * 100;

describe("rule practice", () => {
  it("passes the steady run once the target, five days and consistency are met", () => {
    const review = run("steady");
    expect(review).toMatchObject({ status: "PASSED", decidedOn: 6, profit: r(6_300), bestDay: r(1_500), tradingDays: 6 });
    expect(review.rows.map((row) => row.floor)).toEqual([r(96_000), r(97_200), r(98_700), r(98_700), r(99_500), r(1_00_000)]);
  });

  it("holds the pass while one day is more than half the profit", () => {
    const review = run("one-big-day");
    expect(review).toMatchObject({ status: "ACTIVE", decidedOn: null, profit: r(6_600), targetLeft: 0, daysLeft: 0, bestDay: r(4_500), profitForConsistency: r(9_000) });
  });

  it("fails on the day a loss reaches the daily limit and stops counting", () => {
    const review = run("daily-loss");
    expect(review).toMatchObject({ status: "FAILED", decidedOn: 2 });
    expect(review.rows).toHaveLength(2);
    expect(review.rows[1]).toMatchObject({ breaches: ["DAILY_LOSS"], dailyLossUsed: r(2_000), floor: r(97_000) });
  });

  it("fails when the balance falls to the trailing floor without a daily breach", () => {
    const review = run("trailing");
    expect(review).toMatchObject({ status: "FAILED", decidedOn: 4 });
    expect(review.rows[3]).toMatchObject({ breaches: ["MAX_LOSS"], balance: r(98_800), floor: r(99_000), dailyLossUsed: r(1_200) });
  });

  it("gives the same result on every account size", () => {
    for (const plan of EVALUATION_PLANS) {
      expect(["steady", "one-big-day", "daily-loss", "trailing"].map((id) => [run(id, plan).status, run(id, plan).decidedOn])).toEqual([
        ["PASSED", 6], ["ACTIVE", null], ["FAILED", 2], ["FAILED", 4],
      ]);
    }
  });

  it("reports what is left on a short record", () => {
    expect(reviewPracticeWeek(oneLakh, [r(1_000), r(500)])).toMatchObject({ status: "ACTIVE", targetLeft: r(4_500), daysLeft: 3 });
    expect(reviewPracticeWeek(oneLakh, [])).toMatchObject({ status: "ACTIVE", rows: [], profit: 0, profitForConsistency: 0 });
  });

  it("reads typed rupee amounts exactly and rejects the rest", () => {
    expect(parsePracticeAmount("1,250.50")).toBe(1_25_050);
    expect(parsePracticeAmount("-600")).toBe(-60_000);
    expect(parsePracticeAmount("-0")).toBe(0);
    expect(parsePracticeAmount(".5")).toBe(50);
    for (const bad of ["", "-", "1e3", "12.345", "abc", "123456789"]) expect(parsePracticeAmount(bad)).toBeNull();
  });

  it("rejects too many days and amounts beyond the account", () => {
    expect(() => reviewPracticeWeek(oneLakh, Array(MAX_PRACTICE_DAYS + 1).fill(0))).toThrow();
    expect(() => reviewPracticeWeek(oneLakh, [r(1_00_000) + 1])).toThrow();
  });
});
