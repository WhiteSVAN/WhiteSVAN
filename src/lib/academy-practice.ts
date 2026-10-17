/**
 * Academy rule practice: the evaluation rules run over a record of closing results, day by day.
 * It uses the trading engine's own rule functions, so practice and a real evaluation agree.
 */
import type { EvaluationPlan } from "./prop-firm";
import { divCeil, parseRupees, toPaise, type Paise } from "./trading/money";
import { limitBreaches, maxLossFloor, reviewPass, ruleSetFor, type BreachRule, type DayResult, type RuleSet } from "./trading/rules";

export const MAX_PRACTICE_DAYS = 10;

/** Sample weeks: each day's net P&L in basis points of the starting balance (100 = 1%). */
export const PRACTICE_SCENARIOS = [
  { id: "steady", title: "A steady run", description: "Regular gains and one small losing day.", dailyBps: [120, 150, -60, 140, 130, 150] },
  { id: "one-big-day", title: "One big day", description: "Most of the profit comes from one day, so the consistency rule holds the pass.", dailyBps: [450, 40, 30, 50, 50, 40] },
  { id: "daily-loss", title: "A bad day", description: "One day's loss reaches the daily loss limit.", dailyBps: [100, -200, 150, 200] },
  { id: "trailing", title: "Giving back gains", description: "No day hits the daily limit, but the trailing drawdown catches up.", dailyBps: [300, -150, -150, -120] },
] as const;

export type PracticeScenario = (typeof PRACTICE_SCENARIOS)[number];

export function scenarioAmounts(scenario: PracticeScenario, plan: EvaluationPlan): Paise[] {
  const start = toPaise(plan.balance);
  return scenario.dailyBps.map((bps) => (start * bps) / 10_000);
}

/** A typed day result in rupees (up to two decimals, minus sign for a loss) to paise, or null. */
export function parsePracticeAmount(value: string): Paise | null {
  return parseRupees(value);
}

export type PracticeStatus = "ACTIVE" | "PASSED" | "FAILED";

export interface PracticeRow {
  day: number;
  net: Paise;
  balance: Paise;
  /** The max drawdown floor in force during the day. */
  floor: Paise;
  dailyLossUsed: Paise;
  breaches: BreachRule[];
  passed: boolean;
}

export interface PracticeReview {
  rules: RuleSet;
  /** Days up to and including the one that decided the account. */
  rows: PracticeRow[];
  status: PracticeStatus;
  decidedOn: number | null;
  profit: Paise;
  bestDay: Paise;
  bestDayAllowed: Paise;
  tradingDays: number;
  targetLeft: Paise;
  daysLeft: number;
  /** Total profit at which the current best day meets the consistency rule. */
  profitForConsistency: Paise;
}

export function reviewPracticeWeek(plan: EvaluationPlan, dailyNet: readonly Paise[]): PracticeReview {
  if (dailyNet.length > MAX_PRACTICE_DAYS) throw new RangeError(`Practise with at most ${MAX_PRACTICE_DAYS} days.`);
  const rules = ruleSetFor(plan);
  let balance = rules.startingBalance;
  let highWater = balance;
  let status: PracticeStatus = "ACTIVE";
  let decidedOn: number | null = null;
  const days: DayResult[] = [];
  const rows: PracticeRow[] = [];

  for (const [index, net] of dailyNet.entries()) {
    if (!Number.isSafeInteger(net) || Math.abs(net) > rules.startingBalance) throw new RangeError("Each day must be a whole number of paise within the account size.");
    const opening = balance;
    const floor = maxLossFloor(rules, highWater);
    balance += net;
    const breaches = limitBreaches(rules, { equity: balance, dayOpeningBalance: opening, highWaterEod: highWater });
    days.push({ date: `day-${index + 1}`, net });
    const passed = breaches.length === 0 && reviewPass(rules, balance, days).passed;
    rows.push({ day: index + 1, net, balance, floor, dailyLossUsed: Math.max(0, opening - balance), breaches, passed });
    if (breaches.length > 0 || passed) {
      status = passed ? "PASSED" : "FAILED";
      decidedOn = index + 1;
      break;
    }
    highWater = Math.max(highWater, balance);
  }

  const review = reviewPass(rules, balance, days);
  return {
    rules,
    rows,
    status,
    decidedOn,
    profit: review.profit,
    bestDay: review.bestDay,
    bestDayAllowed: review.bestDayAllowed,
    tradingDays: review.tradingDays,
    targetLeft: Math.max(0, rules.profitTarget - review.profit),
    daysLeft: Math.max(0, rules.minTradingDays - review.tradingDays),
    profitForConsistency: review.bestDay > 0 ? divCeil(review.bestDay * 100, rules.consistencyPercent) : 0,
  };
}
