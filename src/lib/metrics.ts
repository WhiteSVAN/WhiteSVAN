/**
 * Metrics engine — the "code calculates numbers" core.
 *
 * Pure, framework-agnostic functions. The AI layer only ever *explains* these
 * numbers; it never computes them. Keep this file dependency-free so it stays
 * trivially testable and reusable on server or client.
 */

export interface TradeInput {
  /** ISO date `YYYY-MM-DD`. */
  tradeDate: string;
  realizedPnl: number;
  fees?: number;
}

export interface DailyPnl {
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  grossPnl: number;
  fees: number;
  netPnl: number;
  tradeCount: number;
}

export interface EquityPoint {
  date: string;
  /** Account equity = startingBalance + cumulative net P&L. */
  equity: number;
  cumulativePnl: number;
}

export interface Metrics {
  startingBalance: number;
  netPnl: number;
  endingBalance: number;
  /** Simple return over starting balance, as a fraction (0.12 = 12%). */
  returnPct: number | null;
  tradingDays: number;
  winningDays: number;
  losingDays: number;
  /** Winning days / trading days, as a fraction (0..1). */
  winRate: number;
  avgGreenDay: number;
  avgRedDay: number;
  bestDay: number;
  worstDay: number;
  grossProfit: number;
  grossLoss: number;
  /** grossProfit / grossLoss. `null` when there are no losing days. */
  profitFactor: number | null;
  /** Largest peak-to-trough equity decline, in dollars (>= 0). */
  maxDrawdown: number;
  /** Same decline as a percent of the running peak (0..100). */
  maxDrawdownPct: number;
  equityCurve: EquityPoint[];
  /** 0..100 — penalizes single-day dependence and drawdown. */
  consistencyScore: number;
}

/** Group raw trades into one row per calendar day (net = gross − fees). */
export function aggregateDaily(trades: TradeInput[]): DailyPnl[] {
  const byDate = new Map<string, DailyPnl>();
  for (const t of trades) {
    const fees = t.fees ?? 0;
    const row = byDate.get(t.tradeDate) ?? {
      date: t.tradeDate,
      grossPnl: 0,
      fees: 0,
      netPnl: 0,
      tradeCount: 0,
    };
    row.grossPnl += t.realizedPnl;
    row.fees += fees;
    row.netPnl += t.realizedPnl - fees;
    row.tradeCount += 1;
    byDate.set(t.tradeDate, row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Consistency score (0..100). Mirrors the MVP spec: start at 100 and subtract
 * penalties for drawdown, single-day profit dependence, worst-day size, and how
 * often the trader has red days.
 */
export function consistencyScore(input: {
  maxDrawdownPct: number; // percent number, e.g. 12.5
  largestWinShare: number; // fraction 0..1 of total gross profit from best day
  worstDayLossPct: number; // percent number, |worst day| / starting balance
  redDayRatio: number; // fraction 0..1
}): number {
  let score = 100;
  score -= Math.min(30, input.maxDrawdownPct * 4);
  score -= Math.min(25, input.largestWinShare * 100);
  score -= Math.min(20, input.worstDayLossPct * 5);
  score -= Math.min(15, input.redDayRatio * 20);
  return Math.round(clamp(score, 0, 100));
}

/**
 * Compute all dashboard metrics from per-day P&L. `days` need not be sorted.
 */
export function computeMetrics(
  days: Array<Pick<DailyPnl, "date" | "netPnl">>,
  startingBalance: number,
): Metrics {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  const empty: Metrics = {
    startingBalance,
    netPnl: 0,
    endingBalance: startingBalance,
    returnPct: startingBalance > 0 ? 0 : null,
    tradingDays: 0,
    winningDays: 0,
    losingDays: 0,
    winRate: 0,
    avgGreenDay: 0,
    avgRedDay: 0,
    bestDay: 0,
    worstDay: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: null,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
    equityCurve: [],
    consistencyScore: 100,
  };
  if (sorted.length === 0) return empty;

  let netPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0; // positive magnitude
  let winningDays = 0;
  let losingDays = 0;
  let bestDay = -Infinity;
  let worstDay = Infinity;

  let cum = 0;
  let peakEquity = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  const equityCurve: EquityPoint[] = [];

  for (const d of sorted) {
    const pnl = d.netPnl;
    netPnl += pnl;
    if (pnl > 0) {
      grossProfit += pnl;
      winningDays += 1;
    } else if (pnl < 0) {
      grossLoss += -pnl;
      losingDays += 1;
    }
    bestDay = Math.max(bestDay, pnl);
    worstDay = Math.min(worstDay, pnl);

    cum += pnl;
    const equity = startingBalance + cum;
    peakEquity = Math.max(peakEquity, equity);
    const dd = peakEquity - equity;
    maxDrawdown = Math.max(maxDrawdown, dd);
    if (peakEquity > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (dd / peakEquity) * 100);
    equityCurve.push({ date: d.date, equity, cumulativePnl: cum });
  }

  const tradingDays = sorted.length;
  const worstDayLossPct =
    startingBalance > 0 ? (Math.abs(Math.min(0, worstDay)) / startingBalance) * 100 : 0;
  const largestWinShare = grossProfit > 0 ? Math.max(0, bestDay) / grossProfit : 0;

  return {
    startingBalance,
    netPnl,
    endingBalance: startingBalance + netPnl,
    returnPct: startingBalance > 0 ? netPnl / startingBalance : null,
    tradingDays,
    winningDays,
    losingDays,
    winRate: tradingDays > 0 ? winningDays / tradingDays : 0,
    avgGreenDay: winningDays > 0 ? grossProfit / winningDays : 0,
    avgRedDay: losingDays > 0 ? -grossLoss / losingDays : 0,
    bestDay: bestDay === -Infinity ? 0 : bestDay,
    worstDay: worstDay === Infinity ? 0 : worstDay,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    maxDrawdown,
    maxDrawdownPct,
    equityCurve,
    consistencyScore: consistencyScore({
      maxDrawdownPct,
      largestWinShare,
      worstDayLossPct,
      redDayRatio: tradingDays > 0 ? losingDays / tradingDays : 0,
    }),
  };
}
