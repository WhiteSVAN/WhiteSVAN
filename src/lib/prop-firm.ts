/** Public programme preview, from the India v4 draft rulebook. Not an execution engine. */
export const EVALUATION_PLANS = [
  { id: "1l", label: "₹1L", balance: 100_000, fee: 2_999, lots: 1, payoutCap: 5_000 },
  { id: "2-5l", label: "₹2.5L", balance: 250_000, fee: 4_999, lots: 2, payoutCap: 12_500 },
  { id: "5l", label: "₹5L", balance: 500_000, fee: 8_999, lots: 4, payoutCap: 25_000 },
  { id: "10l", label: "₹10L", balance: 1_000_000, fee: 14_999, lots: 8, payoutCap: 50_000 },
] as const;

export type EvaluationPlan = (typeof EVALUATION_PLANS)[number];
export const PROGRAMME_RULES = {
  targetPercent: 6,
  maximumLossPercent: 4,
  dailyLossPercent: 2,
  minimumDays: 5,
  consistencyPercent: 50,
  contractorSharePercent: 80,
  maximumAccounts: 3,
  version: "India v1 · Draft",
} as const;

export function findEvaluationPlan(id: string): EvaluationPlan | undefined {
  return EVALUATION_PLANS.find((plan) => plan.id === id);
}

export function planLimits(plan: EvaluationPlan) {
  return {
    profitTarget: (plan.balance * PROGRAMME_RULES.targetPercent) / 100,
    maximumLoss: (plan.balance * PROGRAMME_RULES.maximumLossPercent) / 100,
    dailyLoss: (plan.balance * PROGRAMME_RULES.dailyLossPercent) / 100,
  };
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(value);
}

export const RULE_SECTIONS = [
  {
    id: "evaluation",
    title: "One evaluation. A clear objective.",
    description: "Reach a 6% net profit target across at least five trading days. At the point of passing, your best day must contribute no more than 50% of total profit. A consistency shortfall delays the pass; it does not end the attempt.",
  },
  {
    id: "drawdown",
    title: "Know your loss limits.",
    description: "The maximum-loss allowance is 4% of the starting simulated balance. Its threshold trails the highest end-of-day balance, then locks at the original starting balance. The daily loss limit is 2% of the starting balance. A maximum-loss or daily-loss breach ends an attempt and must produce a trade-level breach report.",
  },
  {
    id: "markets",
    title: "Built around Indian index markets.",
    description: "The proposed instruments are NIFTY, BANK NIFTY and SENSEX futures and options on listed expiries. Short options are permitted only inside defined-risk spreads. Position limits are in lots, using the current contract master; they are not fixed unit quantities.",
  },
  {
    id: "sessions",
    title: "Trade intraday. Close with the session.",
    description: "Market hours are 09:15–15:30 IST. Positions must be flattened at 15:20. No new positions in expiring contracts are allowed during the final 60 minutes of the session. Overnight holding is not allowed.",
  },
  {
    id: "conduct",
    title: "Your account. Your decisions.",
    description: "Up to three active evaluation or Level 1 accounts are proposed per person. Cross-account hedging, copying another trader, shared logins, account-cap evasion and exploiting stale data or news latency are prohibited. Fees, brokerage, taxes and slippage must be included in simulated results.",
  },
  {
    id: "desk",
    title: "Passing opens a separate contractor pathway.",
    description: "After a pass, KYC and a separate agreement are required. The draft pathway provides an offer within five working days of completed KYC. Contractor accounts remain simulated. Proposed compensation is 80% of eligible simulated net profit, subject to a tier-specific cap per cycle and a retained profit buffer equal to the maximum-loss allowance. Reviews are proposed twice a month.",
  },
  {
    id: "appeals",
    title: "A result you can review.",
    description: "The draft appeal window is seven days. A second reviewer should decide an appeal from the evidence. Final execution, fee, refund and engagement terms will be published before purchases open. Course and evaluation fees are service fees; traders do not contribute trading capital or deposits.",
  },
] as const;
