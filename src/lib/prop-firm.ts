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
  minimumDays: 2,
  consistencyPercent: 50,
  contractorSharePercent: 80,
  /** Funded accounts open at once, per person and household. Evaluations have no limit; a pass beyond this waits. */
  maximumFundedAccounts: 5,
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
  { title: "Get funded", body: "Your funded account opens the moment you pass, with the same loss limits and no profit target." },
  { title: "Get paid", body: `Keep ${PROGRAMME_RULES.contractorSharePercent}% of the profit. Request a payout whenever your profit is above the buffer, up to the cap for your account size.` },
] as const;

/**
 * One rule, written twice: `plain` for new traders, with rupee amounts for the size they're
 * looking at, and `exact` for experienced traders: what is measured, when, and what happens.
 */
export interface Rule {
  /** Anchor on /rules. */
  id: string;
  label: string;
  /** The rule's number for that size, shown large. */
  figure: (plan: EvaluationPlan) => string;
  plain: (plan: EvaluationPlan) => string;
  exact: string;
  /** A worked example for that size, where the rule needs one. */
  example?: (plan: EvaluationPlan) => string;
}

export interface RuleGroup {
  /** Anchor on /rules. Older links use evaluation, desk and markets, so they stay. */
  id: string;
  title: string;
  /** The accounts the group covers. */
  appliesTo: string;
  rules: readonly [Rule, Rule, Rule];
}

const lotsText = (lots: number) => `${lots} ${lots === 1 ? "lot" : "lots"}`;
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
/** No new positions in expiring contracts from this time on expiry day. */
export const EXPIRY_CUTOFF = hhmm(minutesOf(PROGRAMME_RULES.marketClose) - PROGRAMME_RULES.expiryCutoffMinutes);

/** The whole rulebook in four groups of three, as /rules shows it. Figures come from the plans and PROGRAMME_RULES. */
export const RULE_GROUPS: readonly RuleGroup[] = [
  {
    id: "evaluation",
    title: "To pass",
    appliesTo: "Evaluation",
    rules: [
      {
        id: "target",
        label: "Profit target",
        figure: (plan) => formatInr(planLimits(plan).profitTarget),
        plain: (plan) => `Make ${formatInr(planLimits(plan).profitTarget)} profit: ${PROGRAMME_RULES.targetPercent}% of your ${formatInr(plan.balance)} starting balance.`,
        exact: `Profit is your balance minus the starting balance, after every charge. It's checked at each day's close, ${PROGRAMME_RULES.marketClose} IST, with the two rules below: the first close where all three are met is your pass.`,
      },
      {
        id: "days",
        label: "Minimum trading days",
        figure: () => `${PROGRAMME_RULES.minimumDays} days`,
        plain: () => `Trade on at least ${PROGRAMME_RULES.minimumDays} different days before you pass.`,
        exact: "A trading day is a date, in IST, with at least one fill. The days don't have to be in a row.",
      },
      {
        id: "consistency",
        label: "Consistency",
        figure: () => `${PROGRAMME_RULES.consistencyPercent}%`,
        plain: (plan) => `When you pass, no single day can be more than half your profit: on ${formatInr(planLimits(plan).profitTarget)}, your best day must be ${formatInr((planLimits(plan).profitTarget * PROGRAMME_RULES.consistencyPercent) / 100)} or less.`,
        exact: `Your best day is your largest daily result: closing minus opening balance, after charges. At the close where you'd pass, it must be at most ${PROGRAMME_RULES.consistencyPercent}% of your total profit. If it's more, nothing is lost: keep trading until your total profit is at least twice your best day.`,
      },
    ],
  },
  {
    id: "limits",
    title: "To keep your account",
    appliesTo: "Demo and funded accounts",
    rules: [
      {
        id: "daily-loss",
        label: "Daily loss limit",
        figure: (plan) => formatInr(planLimits(plan).dailyLoss),
        plain: (plan) => `Don't lose ${formatInr(planLimits(plan).dailyLoss)} or more in one day: ${PROGRAMME_RULES.dailyLossPercent}% of your starting balance.`,
        exact: "Measured live from the day's opening balance, on your balance plus open P&L, after charges. Touching the limit breaches the account: open positions are closed and the account ends. The limit resets every trading day.",
      },
      {
        id: "drawdown",
        label: "Max drawdown",
        figure: (plan) => formatInr(planLimits(plan).maximumLoss),
        plain: (plan) => `Never fall ${formatInr(planLimits(plan).maximumLoss)} below your highest closing balance. Your floor starts at ${formatInr(plan.balance - planLimits(plan).maximumLoss)} and rises when you close a day at a new high.`,
        exact: `End-of-day trailing: the floor is your highest end-of-day balance minus ${PROGRAMME_RULES.maximumLossPercent}% of the starting balance. It stops rising once it reaches the starting balance and stays there. Equity (balance plus open P&L) is checked live; touching the floor breaches the account.`,
        example: (plan) => {
          const loss = planLimits(plan).maximumLoss;
          const day = plan.balance + loss / 2;
          return `You start at ${formatInr(plan.balance)}, so your floor is ${formatInr(plan.balance - loss)}. Close a day at ${formatInr(day)} and it moves up to ${formatInr(day - loss)}. Once you close a day at ${formatInr(plan.balance + loss)} or more, the floor locks at ${formatInr(plan.balance)} for good.`;
        },
      },
      {
        id: "conduct",
        label: "Fair play",
        figure: () => `${PROGRAMME_RULES.maximumFundedAccounts} funded`,
        plain: () => `Trade only your own accounts, on your own decisions. Hold as many evaluations as you like, and up to ${PROGRAMME_RULES.maximumFundedAccounts} funded accounts at a time.`,
        exact: `Evaluations have no limit. Up to ${PROGRAMME_RULES.maximumFundedAccounts} funded accounts can be open at once, per person and household; a pass beyond that waits in My accounts until one of them ends. Not allowed: hedging across your accounts, copying another trader, sharing a login, trading someone else's account, or exploiting delayed prices or news. Every payout request is checked for these.`,
      },
    ],
  },
  {
    id: "desk",
    title: "To get paid",
    appliesTo: "Funded accounts",
    rules: [
      {
        id: "split",
        label: "Profit split",
        figure: () => `${PROGRAMME_RULES.contractorSharePercent}%`,
        plain: () => `Keep ${PROGRAMME_RULES.contractorSharePercent}% of the profit on your funded account.`,
        exact: `Your funded account opens when you pass, on the same size and loss limits, with no profit target (with ${PROGRAMME_RULES.maximumFundedAccounts} already open, it waits until one ends). You keep ${PROGRAMME_RULES.contractorSharePercent}% of the profit you withdraw and the firm keeps ${100 - PROGRAMME_RULES.contractorSharePercent}%. Tax is deducted at source where it applies.`,
      },
      {
        id: "payouts",
        label: "Payouts",
        figure: (plan) => `${formatInr(plan.payoutCap)} cap`,
        plain: (plan) => `Withdraw whenever your profit is above the ${formatInr(planLimits(plan).maximumLoss)} buffer, up to ${formatInr(plan.payoutCap)} a payout.`,
        exact: "The buffer equals your max drawdown and always stays in the account. Request a payout any time your profit is above it and you have no open positions or orders. Each payout takes your share and the firm's share of that profit off the balance, so you stay a full drawdown above your floor.",
      },
      {
        id: "kyc",
        label: "Before your first payout",
        figure: () => "Once",
        plain: () => "Verify your identity and your bank account, once.",
        exact: "KYC with your PAN and Aadhaar (through DigiLocker), a verified Indian bank account and your signed funded trader agreement. Payouts are paid in rupees to that account.",
      },
    ],
  },
  {
    id: "markets",
    title: "On the platform",
    appliesTo: "Every account: the platform enforces these for you",
    rules: [
      {
        id: "products",
        label: "What you trade",
        figure: (plan) => lotsText(plan.lots),
        plain: (plan) => `Buy NIFTY, BANK NIFTY or SENSEX calls or puts, up to ${lotsText(plan.lots)} open at once, and sell only to close.`,
        exact: "NIFTY and BANK NIFTY options on NSE and SENSEX options on BSE, on listed expiries. Directional only: buy to open, sell to close. No short options, no spreads, and no calls and puts on the same index at once, across all your accounts. The limit counts every open lot together, at the exchange's current lot sizes. Orders that break these are refused.",
      },
      {
        id: "sessions",
        label: "Trading hours",
        figure: () => `${PROGRAMME_RULES.marketOpen}–${PROGRAMME_RULES.squareOff}`,
        plain: () => `Trade from ${PROGRAMME_RULES.marketOpen} to ${PROGRAMME_RULES.squareOff} IST. Anything still open at ${PROGRAMME_RULES.squareOff} is closed for you.`,
        exact: `Orders are accepted ${PROGRAMME_RULES.marketOpen}–${PROGRAMME_RULES.squareOff} IST on trading days. At ${PROGRAMME_RULES.squareOff} open positions are squared off and working orders cancelled, and the day closes at ${PROGRAMME_RULES.marketClose}: nothing is held overnight. You can't open new positions in expiring contracts in the last ${PROGRAMME_RULES.expiryCutoffMinutes} minutes of expiry day, from ${EXPIRY_CUTOFF}, and new orders pause while a contract's prices are delayed.`,
      },
      {
        id: "costs",
        label: "Costs",
        figure: () => "Included",
        plain: () => "Every fill pays what it would at a broker, so your results are realistic.",
        exact: "Each fill includes brokerage, STT, exchange transaction charges, the SEBI fee, stamp duty and GST, from the current rate schedule. Orders fill against the five best bids and offers, with one tick of slippage.",
      },
    ],
  },
];

/** The rules in one minute: what passes, what ends an account and what pays, for one size. */
export function rulesInBrief(plan: EvaluationPlan): readonly { title: string; text: string }[] {
  const limits = planLimits(plan);
  return [
    { title: "Pass", text: `Make ${formatInr(limits.profitTarget)} in at least ${PROGRAMME_RULES.minimumDays} trading days, with no single day over half of it.` },
    { title: "Keep your account", text: `Don't lose ${formatInr(limits.dailyLoss)} in a day, or fall ${formatInr(limits.maximumLoss)} below your highest closing balance.` },
    { title: "Get paid", text: `Keep ${PROGRAMME_RULES.contractorSharePercent}% of the profit above a ${formatInr(limits.maximumLoss)} buffer, up to ${formatInr(plan.payoutCap)} a payout.` },
  ];
}
