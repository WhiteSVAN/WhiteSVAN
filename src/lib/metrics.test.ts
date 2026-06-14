import { describe, it, expect } from "vitest";
import {
  aggregateDaily,
  computeMetrics,
  breakdownByBrokerAndAccount,
  type AccountDailyRow,
} from "./metrics";

describe("aggregateDaily", () => {
  it("groups trades by date and nets out fees", () => {
    const days = aggregateDaily([
      { tradeDate: "2026-05-01", realizedPnl: 100, fees: 2 },
      { tradeDate: "2026-05-01", realizedPnl: 50, fees: 1 },
      { tradeDate: "2026-05-02", realizedPnl: -40, fees: 1 },
    ]);
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ date: "2026-05-01", grossPnl: 150, fees: 3, netPnl: 147, tradeCount: 2 });
    expect(days[1]).toMatchObject({ date: "2026-05-02", netPnl: -41, tradeCount: 1 });
  });
});

describe("computeMetrics", () => {
  const days = [
    { date: "2026-05-01", netPnl: 200 },
    { date: "2026-05-02", netPnl: -100 },
    { date: "2026-05-03", netPnl: 300 },
    { date: "2026-05-04", netPnl: -50 },
  ];

  it("computes core stats", () => {
    const m = computeMetrics(days, 10000);
    expect(m.netPnl).toBe(350);
    expect(m.endingBalance).toBe(10350);
    expect(m.tradingDays).toBe(4);
    expect(m.winningDays).toBe(2);
    expect(m.losingDays).toBe(2);
    expect(m.winRate).toBe(0.5);
    expect(m.bestDay).toBe(300);
    expect(m.worstDay).toBe(-100);
    expect(m.grossProfit).toBe(500);
    expect(m.grossLoss).toBe(150);
    expect(m.profitFactor).toBeCloseTo(500 / 150, 6);
  });

  it("tracks peak-to-trough drawdown", () => {
    const m = computeMetrics(days, 10000);
    // equity: 10200, 10100, 10400, 10350. Worst dip from a peak is 50 (10400->10350).
    expect(m.maxDrawdown).toBe(100); // 10200 -> 10100
    expect(m.maxDrawdownPct).toBeCloseTo((100 / 10200) * 100, 6);
  });

  it("returns null profit factor when there are no losing days", () => {
    const m = computeMetrics([{ date: "2026-05-01", netPnl: 100 }], 10000);
    expect(m.profitFactor).toBeNull();
  });

  it("handles an empty input", () => {
    const m = computeMetrics([], 5000);
    expect(m.netPnl).toBe(0);
    expect(m.endingBalance).toBe(5000);
    expect(m.consistencyScore).toBe(100);
    expect(m.equityCurve).toEqual([]);
  });

  it("consistency score penalizes single-day dependence and drawdown", () => {
    const m = computeMetrics(days, 10000);
    expect(m.consistencyScore).toBeGreaterThanOrEqual(0);
    expect(m.consistencyScore).toBeLessThanOrEqual(100);
    // Half the days are red and one day is 60% of gross profit → not a perfect 100.
    expect(m.consistencyScore).toBeLessThan(100);
  });
});

describe("breakdownByBrokerAndAccount", () => {
  const rows: AccountDailyRow[] = [
    // Fidelity broker, two accounts. "Swing" trades two days (one shared date),
    // "Options" one day. Net: Swing 100−50=50, Options 50 → Fidelity 100.
    { broker: "Fidelity", accountId: "f1", accountName: "Swing", date: "2026-06-01", netPnl: 100, grossPnl: 110, fees: 10, tradeCount: 3 },
    { broker: "Fidelity", accountId: "f1", accountName: "Swing", date: "2026-06-02", netPnl: -50, grossPnl: -50, fees: 0, tradeCount: 1 },
    { broker: "Fidelity", accountId: "f2", accountName: "Options", date: "2026-06-01", netPnl: 50, grossPnl: 55, fees: 5, tradeCount: 2 },
    // Webull broker, one account, net loss.
    { broker: "Webull", accountId: "w1", accountName: "Webull Main", date: "2026-06-01", netPnl: -100, grossPnl: -100, fees: 0, tradeCount: 4 },
  ];

  it("nests accounts under brokers with union-of-days and a signed total", () => {
    const { brokers, totalNet } = breakdownByBrokerAndAccount(rows);
    expect(totalNet).toBe(0); // 50 + 50 − 100

    const fidelity = brokers.find((b) => b.broker === "Fidelity")!;
    expect(fidelity).toMatchObject({
      netPnl: 100,
      grossPnl: 115,
      fees: 15,
      tradeCount: 6,
      tradingDays: 2, // union of 06-01 and 06-02 across both accounts
    });
    expect(fidelity.accounts).toHaveLength(2);
    // Accounts sorted best first: Swing (+50) before Options (+50)? equal nets,
    // both present — assert by lookup instead of order.
    const swing = fidelity.accounts.find((a) => a.accountName === "Swing")!;
    expect(swing).toMatchObject({ netPnl: 50, tradingDays: 2, tradeCount: 4 });
  });

  it("computes share as |net| over total |net| at both levels, sorted best first", () => {
    const { brokers } = breakdownByBrokerAndAccount(rows);
    // total |net| over accounts = |50| + |50| + |−100| = 200
    expect(brokers[0].broker).toBe("Fidelity"); // +100 above −100
    expect(brokers[0].share).toBeCloseTo(0.5, 5); // |100|/200
    expect(brokers[1].share).toBeCloseTo(0.5, 5); // |−100|/200
    const swing = brokers[0].accounts.find((a) => a.accountName === "Swing")!;
    expect(swing.share).toBeCloseTo(0.25, 5); // |50|/200
  });

  it("returns an empty breakdown for no rows", () => {
    expect(breakdownByBrokerAndAccount([])).toEqual({ brokers: [], totalNet: 0 });
  });
});
