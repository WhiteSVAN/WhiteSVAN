import { describe, expect, it } from "vitest";
import { EVALUATION_PLANS, findEvaluationPlan, formatInr, planLimits } from "./prop-firm";

describe("published evaluation preview", () => {
  it("keeps the rupee targets and limits aligned across all four v4 tiers", () => {
    expect(EVALUATION_PLANS.map((plan) => ({ fee: plan.fee, ...planLimits(plan) }))).toEqual([
      { fee: 2999, profitTarget: 6000, maximumLoss: 4000, dailyLoss: 2000 },
      { fee: 4999, profitTarget: 15000, maximumLoss: 10000, dailyLoss: 5000 },
      { fee: 8999, profitTarget: 30000, maximumLoss: 20000, dailyLoss: 10000 },
      { fee: 14999, profitTarget: 60000, maximumLoss: 40000, dailyLoss: 20000 },
    ]);
  });

  it("does not silently select a plan for an invalid detail URL", () => {
    expect(findEvaluationPlan("5l")?.balance).toBe(500000);
    expect(findEvaluationPlan("unlimited")).toBeUndefined();
  });

  it("formats Indian rupee grouping without shortening the disclosed amount", () => {
    expect(formatInr(100000)).toBe("₹1,00,000");
  });
});
