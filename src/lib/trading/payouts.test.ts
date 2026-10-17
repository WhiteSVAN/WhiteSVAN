import { describe, expect, it } from "vitest";
import { EVALUATION_PLANS, findEvaluationPlan } from "../prop-firm";
import { payoutAmounts, payoutCycle, profitForFullPayout } from "./payouts";
import { ruleSetFor } from "./rules";

const oneLakh = ruleSetFor(findEvaluationPlan("1l")!);
const r = (rupees: number) => rupees * 100;

describe("payout amounts", () => {
  it("keeps profit equal to the max drawdown as a buffer", () => {
    expect(payoutAmounts(oneLakh, r(4_000))).toEqual({ buffer: r(4_000), withdrawableProfit: 0, traderShare: 0, payout: 0, debit: 0 });
    expect(payoutAmounts(oneLakh, -r(1_000)).payout).toBe(0);
  });

  it("pays the 80% split of profit above the buffer and takes the full profit off the balance", () => {
    expect(payoutAmounts(oneLakh, r(6_500))).toEqual({ buffer: r(4_000), withdrawableProfit: r(2_500), traderShare: r(2_000), payout: r(2_000), debit: r(2_500) });
  });

  it("caps a payout at the plan's limit", () => {
    expect(payoutAmounts(oneLakh, r(20_000))).toMatchObject({ traderShare: r(12_800), payout: r(5_000), debit: r(6_250) });
  });

  it("pays no more than the trader asks for", () => {
    expect(payoutAmounts(oneLakh, r(20_000), r(1_000))).toMatchObject({ payout: r(1_000), debit: r(1_250) });
    expect(() => payoutAmounts(oneLakh, r(20_000), 0)).toThrow();
  });

  it("rounds the split down to the paisa and never debits more than the withdrawable profit", () => {
    const amounts = payoutAmounts(oneLakh, r(4_000) + 3);
    expect(amounts).toMatchObject({ withdrawableProfit: 3, traderShare: 2, payout: 2, debit: 3 });
  });

  it("states the profit needed for a full payout on every plan", () => {
    expect(EVALUATION_PLANS.map((plan) => profitForFullPayout(ruleSetFor(plan)))).toEqual([r(10_250), r(25_625), r(51_250), r(1_02_500)]);
    for (const plan of EVALUATION_PLANS) {
      const rules = ruleSetFor(plan);
      expect(payoutAmounts(rules, profitForFullPayout(rules)).payout).toBe(rules.payoutCap);
      expect(payoutAmounts(rules, profitForFullPayout(rules) - 2).payout).toBeLessThan(rules.payoutCap);
    }
  });
});

describe("payout cycles", () => {
  it("splits each month at the 15th", () => {
    expect(payoutCycle("2026-11-15")).toBe("2026-11/1");
    expect(payoutCycle("2026-11-16")).toBe("2026-11/2");
    expect(payoutCycle("2026-02-28")).toBe("2026-02/2");
    expect(() => payoutCycle("16/11/2026")).toThrow();
  });
});
