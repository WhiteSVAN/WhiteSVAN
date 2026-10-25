import { describe, expect, it } from "vitest";
import { EVALUATION_PLANS, findAccountPlan, findEvaluationPlan, formatInr, planLimits, PROGRAMME_STEPS, RECOMMENDED_PLAN } from "./prop-firm";

describe("published evaluation preview", () => {
  it("sells three sizes with their rupee targets and limits", () => {
    expect(EVALUATION_PLANS.map((plan) => ({ id: plan.id, fee: plan.fee, ...planLimits(plan) }))).toEqual([
      { id: "1l", fee: 2999, profitTarget: 6000, maximumLoss: 4000, dailyLoss: 2000 },
      { id: "5l", fee: 8999, profitTarget: 30000, maximumLoss: 20000, dailyLoss: 10000 },
      { id: "10l", fee: 14999, profitTarget: 60000, maximumLoss: 40000, dailyLoss: 20000 },
    ]);
  });

  it("stops selling ₹2.5L but keeps it for accounts already opened on it", () => {
    expect(findEvaluationPlan("2-5l")).toBeUndefined();
    expect(findAccountPlan("2-5l")?.label).toBe("₹2.5L");
    expect(findAccountPlan("5l")).toBe(findEvaluationPlan("5l"));
    expect(findAccountPlan("unlimited")).toBeUndefined();
  });

  it("does not silently select a plan for an invalid detail URL", () => {
    expect(findEvaluationPlan("5l")?.balance).toBe(500000);
    expect(findEvaluationPlan("unlimited")).toBeUndefined();
  });

  it("recommends the middle size", () => {
    expect(RECOMMENDED_PLAN).toBe(EVALUATION_PLANS[1]);
    expect(RECOMMENDED_PLAN.id).toBe("5l");
  });

  it("explains the programme in three steps", () => {
    expect(PROGRAMME_STEPS.map(({ title }) => title)).toEqual(["Pass the evaluation", "Get funded", "Get paid"]);
  });

  it("formats Indian rupee grouping without shortening the disclosed amount", () => {
    expect(formatInr(100000)).toBe("₹1,00,000");
  });
});
