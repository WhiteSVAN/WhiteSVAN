/**
 * Track record: the evaluation rules run over a trader's own broker account, day by day from the
 * day the trader chose to start counting. The days are the realized results of imported trades
 * (src/lib/csv, src/lib/ingest), judged with the trading engine's own rule functions, so a track
 * record and a simulated evaluation answer to the same rulebook. A tradebook has no intraday
 * prices, so the loss limits are checked on each day's closing result rather than tick by tick,
 * and lot limits aren't checked.
 */
import type { EvaluationPlan } from "./prop-firm";
import { divCeil, type Paise } from "./trading/money";
import { limitBreaches, maxLossFloor, reviewPass, ruleSetFor, type BreachRule, type DayResult, type RuleSet } from "./trading/rules";

/** NIFTY, BANK NIFTY and SENSEX futures and options: Zerodha symbols start with the name, then the year. */
export const isProgrammeContract = (symbol: string): boolean => /^(NIFTY|BANKNIFTY|SENSEX)\d{2}/.test(symbol);

/** Largest tradebook a sync accepts: under Next.js's default 1 MB Server Action body limit. */
export const MAX_TRADEBOOK_BYTES = 900 * 1024;

export type TrackStatus = "ACTIVE" | "PASSED" | "FAILED";

export interface TrackDay {
  /** IST trading date, `YYYY-MM-DD`. */
  date: string;
  /** The day's realized result after charges. */
  net: Paise;
}

export interface TrackRow extends TrackDay {
  balance: Paise;
  /** The max drawdown floor in force during the day. */
  floor: Paise;
  dailyLossUsed: Paise;
  breaches: BreachRule[];
}

export interface TrackReview {
  rules: RuleSet;
  /** Counted days, oldest first, up to and including the one that decided the record. */
  rows: TrackRow[];
  status: TrackStatus;
  decidedOn: string | null;
  balance: Paise;
  /** The max drawdown floor now. */
  floor: Paise;
  profit: Paise;
  targetLeft: Paise;
  tradingDays: number;
  daysLeft: number;
  bestDay: Paise;
  bestDayAllowed: Paise;
  consistencyMet: boolean;
  /** Total profit at which the current best day meets the consistency rule. */
  profitForConsistency: Paise;
  /** The largest one-day loss so far. */
  worstDayLoss: Paise;
  /** Positions without a closing trade. While any remain, a pass can't be confirmed. */
  openPositions: number;
  /** The first day the rules were met while open positions held the pass. */
  passHeldOn: string | null;
}

export function reviewTrackRecord(
  plan: EvaluationPlan,
  days: readonly TrackDay[],
  options: { start?: string | null; openPositions?: number } = {},
): TrackReview {
  const rules = ruleSetFor(plan);
  const openPositions = options.openPositions ?? 0;
  const counted = days
    .filter((day) => !options.start || day.date >= options.start)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let balance = rules.startingBalance;
  let highWater = balance;
  let status: TrackStatus = "ACTIVE";
  let decidedOn: string | null = null;
  let passHeldOn: string | null = null;
  const results: DayResult[] = [];
  const rows: TrackRow[] = [];

  for (const day of counted) {
    if (!Number.isSafeInteger(day.net)) throw new RangeError("Each day's result must be a whole number of paise.");
    const opening = balance;
    const floor = maxLossFloor(rules, highWater);
    balance += day.net;
    const breaches = limitBreaches(rules, { equity: balance, dayOpeningBalance: opening, highWaterEod: highWater });
    results.push({ date: day.date, net: day.net });
    rows.push({ date: day.date, net: day.net, balance, floor, dailyLossUsed: Math.max(0, opening - balance), breaches });
    if (breaches.length > 0) {
      status = "FAILED";
      decidedOn = day.date;
      break;
    }
    if (reviewPass(rules, balance, results).passed) {
      if (openPositions === 0) {
        status = "PASSED";
        decidedOn = day.date;
        break;
      }
      passHeldOn ??= day.date;
    }
    highWater = Math.max(highWater, balance);
  }

  const review = reviewPass(rules, balance, results);
  return {
    rules,
    rows,
    status,
    decidedOn,
    balance,
    floor: maxLossFloor(rules, highWater),
    profit: review.profit,
    targetLeft: Math.max(0, rules.profitTarget - review.profit),
    tradingDays: review.tradingDays,
    daysLeft: Math.max(0, rules.minTradingDays - review.tradingDays),
    bestDay: review.bestDay,
    bestDayAllowed: review.bestDayAllowed,
    consistencyMet: review.consistencyMet,
    profitForConsistency: review.bestDay > 0 ? divCeil(review.bestDay * 100, rules.consistencyPercent) : 0,
    worstDayLoss: rows.reduce((worst, row) => Math.max(worst, row.dailyLossUsed), 0),
    openPositions,
    passHeldOn,
  };
}
