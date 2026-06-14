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
/** One daily rollup row tagged with the account (and its broker) it belongs to. */
export interface AccountDailyRow {
  broker: string; // broker label (falls back to account name upstream)
  accountId: string;
  accountName: string;
  date: string;
  netPnl: number;
  grossPnl: number;
  fees: number;
  tradeCount: number;
}

export interface AccountBreakdown {
  accountId: string;
  accountName: string;
  netPnl: number;
  grossPnl: number;
  fees: number;
  tradeCount: number;
  /** Distinct calendar days this account traded. */
  tradingDays: number;
  /** |netPnl| as a fraction of total |netPnl| across all accounts (0..1). */
  share: number;
}

export interface BrokerBreakdown {
  broker: string;
  netPnl: number;
  grossPnl: number;
  fees: number;
  tradeCount: number;
  /** Distinct calendar days across this broker's accounts (union, not sum). */
  tradingDays: number;
  /** |netPnl| as a fraction of total |netPnl| across all brokers (0..1). */
  share: number;
  accounts: AccountBreakdown[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Two-level P&L breakdown: brokers with each account nested beneath. `share` (at
 * both levels) is |net P&L| over the summed |net P&L| of all accounts, so the
 * parts add to 1 even with mixed-sign results (a plain net % would be
 * meaningless when some are red and some green). Brokers and the accounts within
 * them are sorted by net P&L, best first.
 */
export function breakdownByBrokerAndAccount(rows: AccountDailyRow[]): {
  brokers: BrokerBreakdown[];
  totalNet: number;
} {
  interface AccAgg {
    accountName: string;
    broker: string;
    netPnl: number;
    grossPnl: number;
    fees: number;
    tradeCount: number;
    days: Set<string>;
  }
  // Aggregate per account first.
  const accs = new Map<string, AccAgg>();
  for (const r of rows) {
    let a = accs.get(r.accountId);
    if (!a) {
      a = {
        accountName: r.accountName,
        broker: r.broker,
        netPnl: 0,
        grossPnl: 0,
        fees: 0,
        tradeCount: 0,
        days: new Set(),
      };
      accs.set(r.accountId, a);
    }
    a.netPnl += r.netPnl;
    a.grossPnl += r.grossPnl;
    a.fees += r.fees;
    a.tradeCount += r.tradeCount;
    a.days.add(r.date);
  }

  const totalAbs = [...accs.values()].reduce((s, a) => s + Math.abs(a.netPnl), 0);
  const share = (net: number) => (totalAbs > 0 ? Math.abs(net) / totalAbs : 0);

  // Then group accounts under their broker.
  interface BrokerAgg {
    netPnl: number;
    grossPnl: number;
    fees: number;
    tradeCount: number;
    days: Set<string>;
    accounts: AccountBreakdown[];
  }
  const brokerAggs = new Map<string, BrokerAgg>();
  for (const [accountId, a] of accs) {
    let b = brokerAggs.get(a.broker);
    if (!b) {
      b = { netPnl: 0, grossPnl: 0, fees: 0, tradeCount: 0, days: new Set(), accounts: [] };
      brokerAggs.set(a.broker, b);
    }
    b.netPnl += a.netPnl;
    b.grossPnl += a.grossPnl;
    b.fees += a.fees;
    b.tradeCount += a.tradeCount;
    for (const d of a.days) b.days.add(d);
    b.accounts.push({
      accountId,
      accountName: a.accountName,
      netPnl: round2(a.netPnl),
      grossPnl: round2(a.grossPnl),
      fees: round2(a.fees),
      tradeCount: a.tradeCount,
      tradingDays: a.days.size,
      share: share(a.netPnl),
    });
  }

  const brokers = [...brokerAggs.entries()]
    .map(([broker, b]) => ({
      broker,
      netPnl: round2(b.netPnl),
      grossPnl: round2(b.grossPnl),
      fees: round2(b.fees),
      tradeCount: b.tradeCount,
      tradingDays: b.days.size,
      share: share(b.netPnl),
      accounts: b.accounts.sort((x, y) => y.netPnl - x.netPnl),
    }))
    .sort((a, b) => b.netPnl - a.netPnl);

  const totalNet = round2([...accs.values()].reduce((s, a) => s + a.netPnl, 0));
  return { brokers, totalNet };
}

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
