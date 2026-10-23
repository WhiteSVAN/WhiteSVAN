import { describe, expect, it } from "vitest";
import { EVALUATION_PLANS, planLimits } from "./prop-firm";
import { programmePreview } from "./programme-preview";

describe("programmePreview", () => {
  it.each(EVALUATION_PLANS)("uses programme limits for $id", (plan) => {
    const preview = programmePreview(plan);
    expect(preview.limits).toEqual(planLimits(plan));
    expect(preview.series).toHaveLength(10);
    expect(preview.pnl).toBe(Math.round(plan.balance * 338 / 10_000));
    expect(preview.equity).toBe(plan.balance + preview.pnl);
    expect(preview.targetProgress).toBeCloseTo(preview.pnl / preview.limits.profitTarget * 100);
    for (const point of preview.series) expect(point.equity).toBe(plan.balance + point.pnl);
  });
  it("does not mutate the authoritative plan", () => {
    const before = JSON.stringify(EVALUATION_PLANS);
    EVALUATION_PLANS.forEach(programmePreview);
    expect(JSON.stringify(EVALUATION_PLANS)).toBe(before);
  });
});
