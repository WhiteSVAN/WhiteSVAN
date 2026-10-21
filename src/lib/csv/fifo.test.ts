import { describe, it, expect } from "vitest";
import { matchFifo, isOptionSymbol, type RawTxn } from "./fifo";

const txn = (over: Partial<RawTxn> & Pick<RawTxn, "idx" | "signedQty" | "grossPerUnit">): RawTxn => ({
  date: "2026-06-10",
  symbol: "X",
  feePerUnit: 0,
  raw: {},
  ...over,
});

describe("isOptionSymbol", () => {
  it("recognizes OCC-style contracts, not plain tickers", () => {
    expect(isOptionSymbol("TSLA260608P400")).toBe(true);
    expect(isOptionSymbol("SPY250117C00450000")).toBe(true);
    expect(isOptionSymbol("-QQQ260610P690")).toBe(true);
    expect(isOptionSymbol("AMZN")).toBe(false);
    expect(isOptionSymbol("AAPL")).toBe(false);
  });
});

describe("matchFifo", () => {
  it("pairs a simple buy → sell round-trip", () => {
    const { trades, openPositions } = matchFifo([
      txn({ idx: 0, signedQty: 10, grossPerUnit: 100, date: "2026-06-01" }),
      txn({ idx: 1, signedQty: -10, grossPerUnit: 130, date: "2026-06-02" }),
    ]);
    expect(openPositions).toBe(0);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      tradeDate: "2026-06-02",
      symbol: "X",
      side: "SELL",
      quantity: 10,
      realizedPnl: 300, // 10 × (130 − 100)
    });
  });

  it("matches FIFO across multiple open lots, leaving the remainder open", () => {
    const { trades, openPositions } = matchFifo([
      txn({ idx: 0, signedQty: 10, grossPerUnit: 1 }),
      txn({ idx: 1, signedQty: 10, grossPerUnit: 2 }),
      txn({ idx: 2, signedQty: -15, grossPerUnit: 5 }),
    ]);
    expect(trades).toHaveLength(1);
    // 10 × (5 − 1) + 5 × (5 − 2) = 40 + 15 = 55
    expect(trades[0].realizedPnl).toBe(55);
    expect(trades[0].quantity).toBe(15);
    expect(openPositions).toBe(1); // 5 of the @2 lot still open
  });

  it("handles a short opened by a sell and closed by a buy", () => {
    const { trades } = matchFifo([
      txn({ idx: 0, signedQty: -10, grossPerUnit: 5, date: "2026-06-01" }),
      txn({ idx: 1, signedQty: 10, grossPerUnit: 3, date: "2026-06-02" }),
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ side: "BUY", quantity: 10, realizedPnl: 20 }); // 10 × (5 − 3)
  });

  it("nets per-unit fees into the trade's fees, keeping realized P&L gross", () => {
    const { trades } = matchFifo([
      txn({ idx: 0, signedQty: 10, grossPerUnit: 100, feePerUnit: 0.5 }),
      txn({ idx: 1, signedQty: -10, grossPerUnit: 110, feePerUnit: 0.7 }),
    ]);
    expect(trades[0].realizedPnl).toBe(100); // gross: 10 × (110 − 100)
    expect(trades[0].fees).toBeCloseTo(12, 5); // 10 × (0.5 + 0.7)
  });

  it("orders a day's fills by execution time when the broker gives one", () => {
    // A short opened at 09:20 and covered at 09:30; by row order alone the buy would open a long.
    const { trades, openLots } = matchFifo([
      txn({ idx: 0, signedQty: 10, grossPerUnit: 3, time: "2026-06-10T09:30:00" }),
      txn({ idx: 1, signedQty: -10, grossPerUnit: 5, time: "2026-06-10T09:20:00" }),
    ]);
    expect(openLots).toEqual([]);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ side: "BUY", quantity: 10, realizedPnl: 20 });
  });

  it("lists each lot left open with the fill that opened it", () => {
    const { openPositions, openLots } = matchFifo([txn({ idx: 0, signedQty: -5, grossPerUnit: 8, raw: { id: "a" } })]);
    expect(openPositions).toBe(1);
    expect(openLots).toEqual([{ symbol: "X", signedQty: -5, raw: { id: "a" } }]);
  });

  it("keeps different symbols in separate FIFO queues", () => {
    const { trades } = matchFifo([
      txn({ idx: 0, symbol: "A", signedQty: 1, grossPerUnit: 10 }),
      txn({ idx: 1, symbol: "B", signedQty: 1, grossPerUnit: 20 }),
      txn({ idx: 2, symbol: "A", signedQty: -1, grossPerUnit: 15 }),
      txn({ idx: 3, symbol: "B", signedQty: -1, grossPerUnit: 18 }),
    ]);
    const bySym = Object.fromEntries(trades.map((t) => [t.symbol, t.realizedPnl]));
    expect(bySym).toEqual({ A: 5, B: -2 });
  });
});
