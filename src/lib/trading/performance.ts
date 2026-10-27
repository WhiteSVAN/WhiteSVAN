/**
 * Quant performance of simulated accounts, from their engine records (pure; the admin portal shows
 * these). Daily figures come from the engine's closed days; trade figures from fills grouped into
 * round trips, where a trade runs from flat to flat in one contract. Amounts are paise, ratios plain
 * numbers. Payouts aren't paid yet; once they debit balances between days, rebuild balances with them.
 *
 * Definitions:
 * - A day's return is its net P&L (after charges) over that day's opening balance. Days are trading
 *   days: dates with a fill.
 * - Sharpe: mean daily return over its sample standard deviation, × √252. The risk-free rate is 0,
 *   since the accounts hold no capital.
 * - Sortino: mean daily return over the downside deviation (the root mean square of the negative
 *   returns, zeros counted), × √252.
 * - Volatility: the sample standard deviation of daily returns, × √252.
 * - Max drawdown: the largest fall in closing balance from an earlier high, the starting balance
 *   included, in paise and as a share of that high.
 * - Calmar: mean daily return × 252 over the max drawdown share.
 * Ratios need at least two days and are null where they're undefined (no spread, no losing day, no
 * drawdown), so a short record never shows a made-up figure.
 */
import type { Paise } from "./money";
import type { DayResult } from "./rules";

export const TRADING_DAYS_PER_YEAR = 252;
const ANNUAL = Math.sqrt(TRADING_DAYS_PER_YEAR);

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: readonly number[]) => sum(values) / values.length;

export interface DailyReturn {
  date: string;
  net: Paise;
  opening: Paise;
  closing: Paise;
  return: number;
}

/** Each closed day with its opening and closing balance, rebuilt from the starting balance. */
export function dailyReturns(startingBalance: Paise, days: readonly DayResult[]): DailyReturn[] {
  let balance = startingBalance;
  return days.map((day) => {
    const opening = balance;
    balance += day.net;
    return { date: day.date, net: day.net, opening, closing: balance, return: opening > 0 ? day.net / opening : 0 };
  });
}

export interface ReturnRatios {
  volatility: number | null;
  sharpe: number | null;
  sortino: number | null;
  /** Mean daily return × 252; null with fewer than two days. */
  annualReturn: number | null;
}

/** Annualized volatility, Sharpe and Sortino of a series of daily returns. */
export function returnRatios(returns: readonly number[]): ReturnRatios {
  if (returns.length < 2) return { volatility: null, sharpe: null, sortino: null, annualReturn: null };
  const average = mean(returns);
  const deviation = Math.sqrt(sum(returns.map((value) => (value - average) ** 2)) / (returns.length - 1));
  const downside = Math.sqrt(sum(returns.map((value) => Math.min(value, 0) ** 2)) / returns.length);
  return {
    volatility: deviation * ANNUAL,
    sharpe: deviation > 0 ? (average / deviation) * ANNUAL : null,
    sortino: downside > 0 ? (average / downside) * ANNUAL : null,
    annualReturn: average * TRADING_DAYS_PER_YEAR,
  };
}

export interface DailyStats extends ReturnRatios {
  days: number;
  winningDays: number;
  losingDays: number;
  /** Winning days over days traded (0..1); null with no days. */
  winningDayRate: number | null;
  netPnl: Paise;
  /** Net P&L over the starting balance. */
  totalReturn: number;
  bestDay: Paise | null;
  worstDay: Paise | null;
  averageWinningDay: Paise | null;
  averageLosingDay: Paise | null;
  /** The best day over the total profit, as the consistency rule measures it; null without a profit. */
  bestDayShare: number | null;
  maxDrawdown: Paise;
  maxDrawdownShare: number;
  calmar: number | null;
}

/** Days with a profit and with a loss, and the averages and extremes of each. */
function dayCounts(nets: readonly Paise[]) {
  const wins = nets.filter((net) => net > 0);
  const losses = nets.filter((net) => net < 0);
  return {
    days: nets.length,
    winningDays: wins.length,
    losingDays: losses.length,
    winningDayRate: nets.length ? wins.length / nets.length : null,
    netPnl: sum(nets),
    bestDay: nets.length ? Math.max(...nets) : null,
    worstDay: nets.length ? Math.min(...nets) : null,
    averageWinningDay: wins.length ? Math.round(sum(wins) / wins.length) : null,
    averageLosingDay: losses.length ? Math.round(sum(losses) / losses.length) : null,
  };
}

const calmar = (ratios: ReturnRatios, drawdownShare: number) => (ratios.annualReturn !== null && drawdownShare > 0 ? ratios.annualReturn / drawdownShare : null);

/** One account's daily performance: its closed days on its starting balance. */
export function dailyStats(startingBalance: Paise, days: readonly DayResult[]): DailyStats {
  const series = dailyReturns(startingBalance, days);
  const counts = dayCounts(days.map((day) => day.net));
  let peak = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownShare = 0;
  for (const day of series) {
    peak = Math.max(peak, day.closing);
    maxDrawdown = Math.max(maxDrawdown, peak - day.closing);
    if (peak > 0) maxDrawdownShare = Math.max(maxDrawdownShare, (peak - day.closing) / peak);
  }
  const ratios = returnRatios(series.map((day) => day.return));
  return {
    ...counts,
    ...ratios,
    totalReturn: startingBalance > 0 ? counts.netPnl / startingBalance : 0,
    bestDayShare: counts.netPnl > 0 && counts.bestDay !== null ? Math.max(counts.bestDay, 0) / counts.netPnl : null,
    maxDrawdown,
    maxDrawdownShare,
    calmar: calmar(ratios, maxDrawdownShare),
  };
}

export interface PooledAccount {
  startingBalance: Paise;
  days: readonly DayResult[];
}

/**
 * Several accounts as one book, for a trader: each date's return is the summed net P&L over the
 * summed opening balance of the accounts that traded it. Drawdown is measured on the compounded
 * return index (accounts of different sizes and start dates have no common balance), so it is a
 * share only; `maxDrawdown` sums nothing and is 0. Total return is on the summed starting balances.
 */
export function pooledStats(accounts: readonly PooledAccount[]): DailyStats {
  const byDate = new Map<string, { net: Paise; opening: Paise }>();
  for (const account of accounts) {
    for (const day of dailyReturns(account.startingBalance, account.days)) {
      const seen = byDate.get(day.date) ?? { net: 0, opening: 0 };
      byDate.set(day.date, { net: seen.net + day.net, opening: seen.opening + day.opening });
    }
  }
  const dates = [...byDate.keys()].sort();
  const pooled = dates.map((date) => byDate.get(date)!);
  const returns = pooled.map((day) => (day.opening > 0 ? day.net / day.opening : 0));
  let index = 1;
  let peak = 1;
  let maxDrawdownShare = 0;
  for (const value of returns) {
    index *= 1 + value;
    peak = Math.max(peak, index);
    maxDrawdownShare = Math.max(maxDrawdownShare, (peak - index) / peak);
  }
  const counts = dayCounts(pooled.map((day) => day.net));
  const capital = sum(accounts.map((account) => account.startingBalance));
  const ratios = returnRatios(returns);
  return {
    ...counts,
    ...ratios,
    totalReturn: capital > 0 ? counts.netPnl / capital : 0,
    bestDayShare: counts.netPnl > 0 && counts.bestDay !== null ? Math.max(counts.bestDay, 0) / counts.netPnl : null,
    maxDrawdown: 0,
    maxDrawdownShare,
    calmar: calmar(ratios, maxDrawdownShare),
  };
}

/** A fill as round trips need it. */
export interface CycleFill {
  /** The engine's fill id, `<account>:F<n>`: its number orders fills made at the same moment. */
  id: string;
  token: number;
  tradingSymbol: string;
  side: "BUY" | "SELL";
  /** Units. */
  quantity: number;
  /** Gross P&L the fill closed. */
  realised: Paise;
  charges: Paise;
  at: number;
}

export interface TradeCycle {
  token: number;
  tradingSymbol: string;
  direction: "LONG" | "SHORT";
  openedAt: number;
  /** Null while the position is still open. */
  closedAt: number | null;
  /** The largest position held, in units. */
  quantity: number;
  fills: number;
  realised: Paise;
  charges: Paise;
  /** Realised less every charge of the round trip, opening fills included. */
  net: Paise;
  holdingMs: number | null;
}

const fillNumber = (id: string) => Number(id.slice(id.lastIndexOf(":F") + 2)) || 0;

/**
 * Round trips: per contract, from flat to flat. A fill that would turn a position through zero
 * (impossible under the directional policy, possible on legacy futures) closes the trade and opens
 * the next with the rest, its charges split by units.
 */
export function tradeCycles(fills: readonly CycleFill[]): { closed: TradeCycle[]; open: TradeCycle[] } {
  const ordered = [...fills].sort((a, b) => a.at - b.at || fillNumber(a.id) - fillNumber(b.id));
  const running = new Map<number, { cycle: TradeCycle; position: number }>();
  const closed: TradeCycle[] = [];
  const begin = (fill: CycleFill, signed: number): TradeCycle => ({ token: fill.token, tradingSymbol: fill.tradingSymbol, direction: signed > 0 ? "LONG" : "SHORT", openedAt: fill.at, closedAt: null, quantity: 0, fills: 0, realised: 0, charges: 0, net: 0, holdingMs: null });
  for (const fill of ordered) {
    let signed = fill.side === "BUY" ? fill.quantity : -fill.quantity;
    if (signed === 0) continue;
    let charges = fill.charges;
    let realised = fill.realised;
    let current = running.get(fill.token);
    while (signed !== 0) {
      if (!current) {
        current = { cycle: begin(fill, signed), position: 0 };
        running.set(fill.token, current);
      }
      const { cycle } = current;
      const closing = current.position !== 0 && Math.sign(signed) !== Math.sign(current.position);
      const units = closing ? Math.min(Math.abs(signed), Math.abs(current.position)) * Math.sign(signed) : signed;
      const share = Math.round((charges * Math.abs(units)) / Math.abs(signed));
      cycle.fills += 1;
      cycle.charges += share;
      cycle.realised += realised;
      current.position += units;
      cycle.quantity = Math.max(cycle.quantity, Math.abs(current.position));
      charges -= share;
      realised = 0;
      signed -= units;
      if (current.position === 0) {
        cycle.closedAt = fill.at;
        cycle.holdingMs = fill.at - cycle.openedAt;
        cycle.net = cycle.realised - cycle.charges;
        closed.push(cycle);
        running.delete(fill.token);
        current = undefined;
      }
    }
  }
  const open = [...running.values()].map(({ cycle }) => ({ ...cycle, net: cycle.realised - cycle.charges }));
  return { closed, open };
}

export interface TradeStats {
  trades: number;
  wins: number;
  losses: number;
  /** Winning trades over closed trades (0..1); null without trades. */
  winRate: number | null;
  averageWin: Paise | null;
  averageLoss: Paise | null;
  /** Average win over the size of the average loss. */
  payoffRatio: number | null;
  /** Gross profit of winning trades over gross loss of losing ones. */
  profitFactor: number | null;
  /** Average net P&L per trade. */
  expectancy: Paise | null;
  largestWin: Paise | null;
  largestLoss: Paise | null;
  averageHoldingMs: number | null;
  /** Charges paid on closed trades. */
  charges: Paise;
  /** Charges over realised profit before charges; null unless that profit is positive. */
  chargesShare: number | null;
}

/** Win rate, payoff, profit factor and the rest, over closed round trips (net of charges). */
export function tradeStats(cycles: readonly TradeCycle[]): TradeStats {
  const nets = cycles.map((cycle) => cycle.net);
  const wins = nets.filter((net) => net > 0);
  const losses = nets.filter((net) => net < 0);
  const grossWin = sum(wins);
  const grossLoss = -sum(losses);
  const averageWin = wins.length ? Math.round(grossWin / wins.length) : null;
  const averageLoss = losses.length ? Math.round(-grossLoss / losses.length) : null;
  const holding = cycles.flatMap((cycle) => (cycle.holdingMs === null ? [] : [cycle.holdingMs]));
  const realised = sum(cycles.map((cycle) => cycle.realised));
  const charges = sum(cycles.map((cycle) => cycle.charges));
  return {
    trades: cycles.length,
    wins: wins.length,
    losses: losses.length,
    winRate: cycles.length ? wins.length / cycles.length : null,
    averageWin,
    averageLoss,
    payoffRatio: averageWin !== null && averageLoss !== null && averageLoss !== 0 ? averageWin / -averageLoss : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    expectancy: cycles.length ? Math.round(sum(nets) / cycles.length) : null,
    largestWin: wins.length ? Math.max(...wins) : null,
    largestLoss: losses.length ? Math.min(...losses) : null,
    averageHoldingMs: holding.length ? Math.round(mean(holding)) : null,
    charges,
    chargesShare: realised > 0 ? charges / realised : null,
  };
}
