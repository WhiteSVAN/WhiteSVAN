/** Synthetic classroom examples only. These are not exchange trades or an evaluation score. */
export const PRACTICE_SCENARIOS = [
  {
    id: "within-limits",
    title: "A measured week",
    description: "Mixed results with relatively small closed-P&L losses.",
    dailyNetInr: [1200, -800, 1600, -600, 1800],
  },
  {
    id: "daily-limit",
    title: "A loss, then a recovery",
    description: "Later profits do not erase an earlier rule breach.",
    dailyNetInr: [-1200, -2000, 1600, 2000, 800],
  },
  {
    id: "drawdown",
    title: "Several smaller losses",
    description: "Losses can accumulate even when no single day reaches its limit.",
    dailyNetInr: [1000, -1800, -1700, -1600, 2200],
  },
] as const;

export type PracticeReview = {
  rows: { session: number; netInr: number; balanceInr: number; drawdownInr: number; dailyReached: boolean; drawdownReached: boolean }[];
  totalNetInr: number;
  worstDayLossInr: number;
  maxDrawdownInr: number;
  firstDailyBreach: number | null;
  firstDrawdownBreach: number | null;
};

export function isPracticeLimit(value: number): boolean {
  return Number.isFinite(value) && value >= 0.01 && value <= 100000
    && Math.abs(value * 100 - Math.round(value * 100)) < 0.0000001;
}

/** Reject sub-paise precision and exponent notation rather than silently changing a typed limit. */
export function parsePracticeLimit(value: string): number | null {
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value)) return null;
  const amount = Number(value);
  return isPracticeLimit(amount) ? amount : null;
}

/** Both example rules breach at equality. Use integer paise for comparisons and totals. */
export function reviewPracticeDays(
  dailyNetInr: readonly number[],
  dailyLossLimitInr: number,
  drawdownLimitInr: number,
): PracticeReview {
  if (![dailyLossLimitInr, drawdownLimitInr].every(isPracticeLimit)) {
    throw new Error("Example limits must be between ₹0.01 and ₹1,00,000 with at most two decimal places.");
  }
  if (!dailyNetInr.every((v) => Number.isFinite(v) && Math.abs(v) <= 100000)) {
    throw new Error("Invalid example P&L.");
  }
  const dailyLimit = Math.round(dailyLossLimitInr * 100);
  const drawdownLimit = Math.round(drawdownLimitInr * 100);
  const startingBalance = 10000000; // Virtual ₹1,00,000. No deposit or capital allocation.
  let balance = startingBalance;
  let peak = balance;
  let worstLoss = 0;
  let maxDrawdown = 0;
  let firstDailyBreach: number | null = null;
  let firstDrawdownBreach: number | null = null;
  const rows = dailyNetInr.map((net, index) => {
    const netPaise = Math.round(net * 100);
    balance += netPaise;
    peak = Math.max(peak, balance);
    const drawdown = peak - balance;
    const dailyReached = -netPaise >= dailyLimit;
    const drawdownReached = drawdown >= drawdownLimit;
    worstLoss = Math.max(worstLoss, -netPaise);
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    if (dailyReached && firstDailyBreach === null) firstDailyBreach = index + 1;
    if (drawdownReached && firstDrawdownBreach === null) firstDrawdownBreach = index + 1;
    return { session: index + 1, netInr: netPaise / 100, balanceInr: balance / 100, drawdownInr: drawdown / 100, dailyReached, drawdownReached };
  });
  return { rows, totalNetInr: (balance - startingBalance) / 100, worstDayLossInr: worstLoss / 100, maxDrawdownInr: maxDrawdown / 100, firstDailyBreach, firstDrawdownBreach };
}
