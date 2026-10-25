/** WhiteSVAN programme terms (India v1 rulebook). Display data only: not an execution engine. */

/** The three account sizes on sale. */
export const EVALUATION_PLANS = [
  { id: "1l", label: "₹1L", balance: 100_000, fee: 2_999, lots: 1, payoutCap: 5_000 },
  { id: "5l", label: "₹5L", balance: 500_000, fee: 8_999, lots: 4, payoutCap: 25_000 },
  { id: "10l", label: "₹10L", balance: 1_000_000, fee: 14_999, lots: 8, payoutCap: 50_000 },
] as const;

/** Sizes no longer sold. Accounts already opened on one keep it. */
const RETIRED_PLANS = [
  { id: "2-5l", label: "₹2.5L", balance: 250_000, fee: 4_999, lots: 2, payoutCap: 12_500 },
] as const;

export type EvaluationPlan = (typeof EVALUATION_PLANS)[number] | (typeof RETIRED_PLANS)[number];

/** The middle size: the pricing cards mark it Recommended, and checkout opens on it. */
export const RECOMMENDED_PLAN: EvaluationPlan = EVALUATION_PLANS[1];

export const PROGRAMME_RULES = {
  targetPercent: 6,
  maximumLossPercent: 4,
  dailyLossPercent: 2,
  minimumDays: 5,
  consistencyPercent: 50,
  contractorSharePercent: 80,
  maximumAccounts: 3,
  /** IST session times: market open, automatic square-off, market close. */
  marketOpen: "09:15",
  squareOff: "15:20",
  marketClose: "15:30",
  /** No new positions in a contract during the last hour of its expiry day. */
  expiryCutoffMinutes: 60,
  version: "India v1",
} as const;

/** A size on sale. */
export function findEvaluationPlan(id: string): EvaluationPlan | undefined {
  return EVALUATION_PLANS.find((plan) => plan.id === id);
}

/** The size an account was opened on, including sizes no longer sold. */
export function findAccountPlan(id: string): EvaluationPlan | undefined {
  return findEvaluationPlan(id) ?? RETIRED_PLANS.find((plan) => plan.id === id);
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

/** The programme in three steps, wherever the site explains it. */
export const PROGRAMME_STEPS = [
  { title: "Pass the evaluation", body: `Hit the ${PROGRAMME_RULES.targetPercent}% profit target in at least ${PROGRAMME_RULES.minimumDays} trading days without touching the daily loss limit or the max drawdown.` },
  { title: "Get funded", body: "Complete KYC and sign your funded trader agreement. Your funded account is simulated and keeps the same loss limits, with no profit target." },
  { title: "Get paid", body: `Keep ${PROGRAMME_RULES.contractorSharePercent}% of the profit, paid to your bank twice a month, up to the cap for your account size.` },
] as const;

export const RULE_SECTIONS = [
  {
    id: "evaluation",
    label: "Profit target",
    title: "Hit the profit target.",
    description: "Make 6% on your starting balance in at least five trading days. When you pass, your best day can be no more than 50% of your total profit. Missing the consistency rule doesn't fail you: keep trading until your best day is 50% or less of your total profit.",
  },
  {
    id: "drawdown",
    label: "Drawdown & daily loss",
    title: "Stay inside your drawdown.",
    description: "Your maximum drawdown is 4% of the starting balance. It trails your highest end-of-day balance and stops trailing once it reaches your starting balance. Your daily loss limit is 2% of the starting balance, measured on open and closed P&L. Hitting either limit ends the account, and you get a breach report showing the trade and the rule.",
  },
  {
    id: "markets",
    label: "Products",
    title: "Trade Indian index futures and options.",
    description: "NIFTY and BANK NIFTY on NSE, and SENSEX on BSE: futures and options on listed expiries. Sell options only inside defined-risk spreads; naked short options are not allowed. Position limits are in lots and follow the exchange's current lot sizes.",
  },
  {
    id: "sessions",
    label: "Trading hours",
    title: "Trade intraday only.",
    description: "The market is open 09:15–15:30 IST. Close every position by 15:20; anything still open is closed automatically. You can't open new positions in expiring contracts in the last 60 minutes of expiry day, and positions can't be held overnight.",
  },
  {
    id: "conduct",
    label: "Prohibited activity",
    title: "Trade your own account, your own way.",
    description: "Up to three evaluation or funded accounts per trader. Not allowed: hedging across accounts, copying another trader, sharing logins, using another person's account or exploiting stale prices or news delays. Every fill includes brokerage, STT, exchange charges, the SEBI fee, stamp duty and GST.",
  },
  {
    id: "desk",
    label: "Funded accounts & payouts",
    title: "Get funded and get paid.",
    description: "Pass, complete KYC (PAN, Aadhaar and bank verification) and sign your funded trader agreement. You keep 80% of the profit on your funded account. Request a payout twice a month, up to the cap for your account size; profit equal to your maximum drawdown stays in the account as a buffer. Funded accounts are simulated and keep the same loss limits.",
  },
  {
    id: "appeals",
    label: "Fees & appeals",
    title: "One fee. A fair review.",
    description: "Each evaluation is a one-time fee with GST included: no subscription and no activation fee. Think a breach was wrong? Appeal within seven days and a second reviewer decides from the trade data. Fees are for the evaluation service; you never deposit trading capital.",
  },
] as const;
