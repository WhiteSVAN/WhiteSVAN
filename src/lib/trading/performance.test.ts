import { describe, expect, it } from "vitest";
import { dailyReturns, dailyStats, pooledStats, returnRatios, tradeCycles, tradeStats, type CycleFill } from "./performance";

// Test fixtures, not exchange values. ₹1L is 1,00,00,000 paise.
const LAKH = 10_000_000;
const days = (...nets: number[]) => nets.map((net, index) => ({ date: `2026-11-${String(index + 2).padStart(2, "0")}`, net }));

describe("daily performance", () => {
  it("rebuilds each day's opening and closing balance and its return", () => {
    expect(dailyReturns(LAKH, days(100_000, -50_000))).toEqual([
      { date: "2026-11-02", net: 100_000, opening: LAKH, closing: LAKH + 100_000, return: 0.01 },
      { date: "2026-11-03", net: -50_000, opening: LAKH + 100_000, closing: LAKH + 50_000, return: -50_000 / (LAKH + 100_000) },
    ]);
  });

  it("counts days, finds the best and worst, and measures drawdown from the highest close", () => {
    const stats = dailyStats(LAKH, days(100_000, -50_000, 200_000));
    expect(stats).toMatchObject({
      days: 3, winningDays: 2, losingDays: 1, netPnl: 250_000, totalReturn: 0.025,
      bestDay: 200_000, worstDay: -50_000, averageWinningDay: 150_000, averageLosingDay: -50_000,
      bestDayShare: 0.8, maxDrawdown: 50_000,
    });
    expect(stats.winningDayRate).toBeCloseTo(2 / 3, 12);
    expect(stats.maxDrawdownShare).toBeCloseTo(50_000 / (LAKH + 100_000), 12);
  });

  it("annualizes Sharpe, Sortino and volatility over √252, with a zero risk-free rate", () => {
    // Worked independently: returns 1%, −0.495%, 1.990%; mean 0.8317%, sample SD 1.2511%.
    const stats = dailyStats(LAKH, days(100_000, -50_000, 200_000));
    expect(stats.sharpe).toBeCloseTo(10.55278854591359, 9);
    expect(stats.sortino).toBeCloseTo(46.19145104979269, 9);
    expect(stats.volatility).toBeCloseTo(0.19860155424965167, 12);
    expect(stats.annualReturn).toBeCloseTo(2.0958002068863606, 12);
    expect(stats.calmar).toBeCloseTo(423.3516417910448, 6);
  });

  it("shows no ratio it can't support: one day, no spread, no losing day, no drawdown", () => {
    expect(returnRatios([0.01])).toEqual({ volatility: null, sharpe: null, sortino: null, annualReturn: null });
    expect(returnRatios([0.01, 0.01])).toMatchObject({ volatility: 0, sharpe: null, sortino: null });
    expect(dailyStats(LAKH, days(100_000, 200_000))).toMatchObject({ sortino: null, calmar: null, maxDrawdownShare: 0 });
    expect(dailyStats(LAKH, [])).toMatchObject({ days: 0, winningDayRate: null, bestDay: null, bestDayShare: null, sharpe: null, netPnl: 0, totalReturn: 0 });
  });

  it("has no best-day share without a profit", () => {
    expect(dailyStats(LAKH, days(-10_000, 5_000)).bestDayShare).toBeNull();
  });

  it("pools a trader's accounts: each date's summed net over the summed opening balance", () => {
    const stats = pooledStats([
      { startingBalance: LAKH, days: days(100_000, -50_000) },
      { startingBalance: 5 * LAKH, days: [{ date: "2026-11-03", net: 500_000 }] },
    ]);
    expect(stats).toMatchObject({ days: 2, netPnl: 550_000, winningDays: 2, maxDrawdown: 0, maxDrawdownShare: 0 });
    expect(stats.totalReturn).toBeCloseTo(550_000 / (6 * LAKH), 12);
    // 1%, then (−50,000 + 5,00,000) / (1,01,00,000 + 5,00,00,000).
    expect(stats.annualReturn).toBeCloseTo(((0.01 + 450_000 / 60_100_000) / 2) * 252, 12);
  });
});

const fill = (n: number, fields: Partial<CycleFill> & Pick<CycleFill, "side" | "quantity" | "at">): CycleFill =>
  ({ id: `acct:F${n}`, token: 1, tradingSymbol: "NIFTY-CE", realised: 0, charges: 0, ...fields });

describe("round trips", () => {
  it("runs a trade from flat to flat, across partial exits, net of every charge", () => {
    const { closed, open } = tradeCycles([
      fill(1, { side: "BUY", quantity: 150, at: 1_000, charges: 40 }),
      fill(2, { side: "SELL", quantity: 75, at: 2_000, realised: 1_500, charges: 30 }),
      fill(3, { side: "SELL", quantity: 75, at: 5_000, realised: 900, charges: 30 }),
    ]);
    expect(open).toEqual([]);
    expect(closed).toEqual([{ token: 1, tradingSymbol: "NIFTY-CE", direction: "LONG", openedAt: 1_000, closedAt: 5_000, quantity: 150, fills: 3, realised: 2_400, charges: 100, net: 2_300, holdingMs: 4_000 }]);
  });

  it("keeps contracts apart, orders same-moment fills by number, and reports what's still open", () => {
    const { closed, open } = tradeCycles([
      fill(4, { side: "SELL", quantity: 75, at: 1_000, realised: -300, charges: 10 }),
      fill(3, { side: "BUY", quantity: 75, at: 1_000, charges: 10 }),
      fill(5, { token: 2, tradingSymbol: "NIFTY-PE", side: "BUY", quantity: 75, at: 1_500, charges: 12 }),
    ]);
    expect(closed).toMatchObject([{ token: 1, net: -320, holdingMs: 0 }]);
    expect(open).toMatchObject([{ token: 2, closedAt: null, holdingMs: null, quantity: 75, net: -12 }]);
  });

  it("splits a fill that turns a position through zero, charges by units", () => {
    const { closed, open } = tradeCycles([
      fill(1, { side: "BUY", quantity: 50, at: 1_000, charges: 20 }),
      fill(2, { side: "SELL", quantity: 150, at: 2_000, realised: 600, charges: 90 }),
    ]);
    expect(closed).toMatchObject([{ direction: "LONG", realised: 600, charges: 50, net: 550 }]);
    expect(open).toMatchObject([{ direction: "SHORT", quantity: 100, charges: 60, net: -60 }]);
  });
});

describe("trade statistics", () => {
  const cycle = (net: number, holdingMs: number, realised = net + 10) => ({ token: 1, tradingSymbol: "X", direction: "LONG" as const, openedAt: 0, closedAt: holdingMs, quantity: 75, fills: 2, realised, charges: realised - net, net, holdingMs });

  it("measures win rate, payoff, profit factor and expectancy on closed trades", () => {
    const stats = tradeStats([cycle(3_000, 60_000), cycle(1_000, 120_000), cycle(-1_000, 30_000), cycle(-3_000, 30_000)]);
    expect(stats).toEqual({
      trades: 4, wins: 2, losses: 2, winRate: 0.5,
      averageWin: 2_000, averageLoss: -2_000, payoffRatio: 1, profitFactor: 1, expectancy: 0,
      largestWin: 3_000, largestLoss: -3_000, averageHoldingMs: 60_000,
      // Realised before charges is 3,010 + 1,010 − 990 − 2,990 = 40, all of it spent on charges.
      charges: 40, chargesShare: 1,
    });
  });

  it("puts charges against the profit they came out of", () => {
    const stats = tradeStats([cycle(900, 1_000, 1_000), cycle(-100, 1_000, 0)]);
    expect(stats).toMatchObject({ charges: 200, chargesShare: 0.2, profitFactor: 9, payoffRatio: 9 });
  });

  it("leaves ratios empty without trades or without losses", () => {
    expect(tradeStats([])).toMatchObject({ trades: 0, winRate: null, expectancy: null, profitFactor: null, averageHoldingMs: null });
    expect(tradeStats([cycle(500, 1_000)])).toMatchObject({ winRate: 1, profitFactor: null, payoffRatio: null, averageLoss: null });
  });
});
