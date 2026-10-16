/**
 * Rule engine core (TRD RULE, story S4-06): the programme's loss limits and pass conditions as
 * pure functions over paise. A RuleSet is copied onto an account at purchase, so later rulebook
 * changes never touch an existing account (RULE-1).
 */
import { PROGRAMME_RULES, type EvaluationPlan } from "../prop-firm";
import { percentOfFloor, toPaise, type Paise } from "./money";
import { clockSeconds } from "./time";

export interface SessionTimes {
  /** IST seconds after midnight. */
  open: number;
  squareOff: number;
  close: number;
  /** From here on expiry day, no new positions in the expiring contracts. */
  expiryCutoff: number;
}

export interface RuleSet {
  version: string;
  planId: string;
  startingBalance: Paise;
  profitTarget: Paise;
  maxLoss: Paise;
  dailyLoss: Paise;
  minTradingDays: number;
  /** At a pass, the best day may be at most this percent of total profit. */
  consistencyPercent: number;
  maxLots: number;
  profitSplitPercent: number;
  payoutCap: Paise;
  session: SessionTimes;
}

export function ruleSetFor(plan: EvaluationPlan): RuleSet {
  const start = toPaise(plan.balance);
  const close = clockSeconds(PROGRAMME_RULES.marketClose);
  return {
    version: PROGRAMME_RULES.version,
    planId: plan.id,
    startingBalance: start,
    profitTarget: percentOfFloor(start, PROGRAMME_RULES.targetPercent),
    maxLoss: percentOfFloor(start, PROGRAMME_RULES.maximumLossPercent),
    dailyLoss: percentOfFloor(start, PROGRAMME_RULES.dailyLossPercent),
    minTradingDays: PROGRAMME_RULES.minimumDays,
    consistencyPercent: PROGRAMME_RULES.consistencyPercent,
    maxLots: plan.lots,
    profitSplitPercent: PROGRAMME_RULES.contractorSharePercent,
    payoutCap: toPaise(plan.payoutCap),
    session: {
      open: clockSeconds(PROGRAMME_RULES.marketOpen),
      squareOff: clockSeconds(PROGRAMME_RULES.squareOff),
      close,
      expiryCutoff: close - PROGRAMME_RULES.expiryCutoffMinutes * 60,
    },
  };
}

/**
 * The max-drawdown floor trails the highest end-of-day balance (the starting balance counts) by
 * `maxLoss` and stops rising once it reaches the starting balance.
 */
export function maxLossFloor(rules: RuleSet, highWaterEod: Paise): Paise {
  return Math.min(highWaterEod - rules.maxLoss, rules.startingBalance);
}

export type BreachRule = "DAILY_LOSS" | "MAX_LOSS";

export interface LimitInput {
  /** Balance plus unrealised P&L on open positions. */
  equity: Paise;
  dayOpeningBalance: Paise;
  highWaterEod: Paise;
}

/** Limits hit at this equity. Hitting a limit counts: equality breaches. */
export function limitBreaches(rules: RuleSet, input: LimitInput): BreachRule[] {
  const hits: BreachRule[] = [];
  if (input.dayOpeningBalance - input.equity >= rules.dailyLoss) hits.push("DAILY_LOSS");
  if (input.equity <= maxLossFloor(rules, input.highWaterEod)) hits.push("MAX_LOSS");
  return hits;
}

export interface DayResult {
  /** IST trading date with at least one fill. */
  date: string;
  /** Closing balance minus opening balance, after charges. */
  net: Paise;
}

export interface PassReview {
  passed: boolean;
  profit: Paise;
  targetMet: boolean;
  tradingDays: number;
  daysMet: boolean;
  bestDay: Paise;
  /** Largest best day the consistency rule allows at the current profit. */
  bestDayAllowed: Paise;
  consistencyMet: boolean;
}

/** Pass check at a day's close (RULE-3): target, minimum days and consistency all met. */
export function reviewPass(rules: RuleSet, balance: Paise, days: readonly DayResult[]): PassReview {
  const profit = balance - rules.startingBalance;
  const bestDay = days.reduce((best, day) => Math.max(best, day.net), 0);
  const targetMet = profit >= rules.profitTarget;
  const daysMet = days.length >= rules.minTradingDays;
  const consistencyMet = profit > 0 && bestDay * 100 <= rules.consistencyPercent * profit;
  return {
    passed: targetMet && daysMet && consistencyMet,
    profit,
    targetMet,
    tradingDays: days.length,
    daysMet,
    bestDay,
    bestDayAllowed: profit > 0 ? percentOfFloor(profit, rules.consistencyPercent) : 0,
    consistencyMet,
  };
}
