import { describe, expect, it } from "vitest";
import { EVALUATION_PLANS, EXPIRY_CUTOFF, PROGRAMME_RULES, RULE_GROUPS, findEvaluationPlan, planLimits } from "../prop-firm";
import { limitBreaches, maxLossFloor, reviewPass, ruleSetFor } from "./rules";

const rules = ruleSetFor(findEvaluationPlan("1l")!);
const L = (rupees: number) => rupees * 100;

describe("rule sets", () => {
  it("derive every limit in paise from the published plans", () => {
    for (const plan of EVALUATION_PLANS) {
      const set = ruleSetFor(plan);
      const limits = planLimits(plan);
      expect(set).toMatchObject({
        version: PROGRAMME_RULES.version,
        planId: plan.id,
        startingBalance: L(plan.balance),
        profitTarget: L(limits.profitTarget),
        maxLoss: L(limits.maximumLoss),
        dailyLoss: L(limits.dailyLoss),
        maxLots: plan.lots,
        payoutCap: L(plan.payoutCap),
        profitSplitPercent: 80,
        minTradingDays: 2,
        consistencyPercent: 50,
      });
    }
  });

  it("use the IST session times the rulebook publishes", () => {
    expect(rules.session).toEqual({ open: 9 * 3600 + 15 * 60, squareOff: 15 * 3600 + 20 * 60, close: 15 * 3600 + 30 * 60, expiryCutoff: 14 * 3600 + 30 * 60 });
    const hours = RULE_GROUPS.flatMap((group) => group.rules).find((rule) => rule.id === "sessions")!.exact;
    for (const time of [PROGRAMME_RULES.marketOpen, PROGRAMME_RULES.squareOff, PROGRAMME_RULES.marketClose]) expect(hours).toContain(time);
    expect(hours).toContain(`last ${PROGRAMME_RULES.expiryCutoffMinutes} minutes`);
    expect(EXPIRY_CUTOFF).toBe("14:30");
    expect(hours).toContain(EXPIRY_CUTOFF);
  });
});

describe("max drawdown floor", () => {
  it("trails the highest end-of-day balance and locks at the starting balance", () => {
    expect(maxLossFloor(rules, L(1_00_000))).toBe(L(96_000));
    expect(maxLossFloor(rules, L(1_02_000))).toBe(L(98_000));
    expect(maxLossFloor(rules, L(1_04_000))).toBe(L(1_00_000));
    expect(maxLossFloor(rules, L(1_10_000))).toBe(L(1_00_000));
  });
});

describe("limit breaches", () => {
  const at = (equity: number, dayOpeningBalance = L(1_00_000), highWaterEod = L(1_00_000)) => limitBreaches(rules, { equity, dayOpeningBalance, highWaterEod });

  it("counts touching the daily loss limit as a breach", () => {
    expect(at(L(98_000))).toEqual(["DAILY_LOSS"]);
    expect(at(L(98_000) + 1)).toEqual([]);
  });

  it("counts touching the max drawdown floor as a breach", () => {
    expect(at(L(99_000), L(1_00_500), L(1_03_000))).toEqual(["MAX_LOSS"]);
    expect(at(L(99_000) + 1, L(1_00_500), L(1_03_000))).toEqual([]);
  });

  it("reports both limits when one move hits both", () => {
    expect(at(L(96_000), L(97_500))).toEqual(["MAX_LOSS"]);
    expect(at(L(96_000), L(98_000))).toEqual(["DAILY_LOSS", "MAX_LOSS"]);
  });
});

describe("pass review", () => {
  const days = (...nets: number[]) => nets.map((net, index) => ({ date: `2026-11-${String(index + 2).padStart(2, "0")}`, net: L(net) }));

  it("passes with the target, two trading days and a best day at half the profit", () => {
    const review = reviewPass(rules, L(1_06_000), days(3_000, 3_000));
    expect(review).toMatchObject({ passed: true, targetMet: true, daysMet: true, consistencyMet: true, bestDay: L(3_000), bestDayAllowed: L(3_000) });
    expect(reviewPass(rules, L(1_06_000), days(3_000, 750, 750, 750, 750)).passed).toBe(true);
  });

  it("holds the pass while the best day is over half the profit", () => {
    const record = days(3_000, 750, 750, 750, 750);
    record[0].net += 2; // two paise over half
    const review = reviewPass(rules, L(1_06_000) + 2, record);
    expect(review.bestDay).toBe(L(3_000) + 2);
    expect(review.consistencyMet).toBe(false);
    expect(review.passed).toBe(false);
  });

  it("needs the minimum trading days and the full target", () => {
    expect(reviewPass(rules, L(1_06_000), days(6_000))).toMatchObject({ daysMet: false, passed: false });
    expect(reviewPass(rules, L(1_06_000) - 1, days(1_200, 1_200, 1_200, 1_200, 1_200)).targetMet).toBe(false);
  });

  it("never treats a loss as consistent", () => {
    expect(reviewPass(rules, L(99_000), days(-500, -500)).consistencyMet).toBe(false);
  });
});
