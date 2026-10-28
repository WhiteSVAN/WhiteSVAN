import { describe, expect, it } from "vitest";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { openDesk } from "@/lib/trading/desk";
import { ist } from "@/lib/trading/time";
import { contractInstrument, type KiteContract, type MarketQuote } from "@/lib/zerodha/kite";
import { applyExits, applyModify, applyOrder, applyTick, engineBooks, MAX_TICK_KEYS, orderPolicyProblem, screenQuotes, tickKeys } from "./ticks";

// Fixture values, not exchange values.
const FUT: KiteContract = { token: 13238786, exchange: "NFO", tradingSymbol: "NIFTY26OCTFUT", underlying: "NIFTY", kind: "FUT", expiry: "2026-10-27", strike: null, lotSize: 75, tickSize: 10 };
const r = (rupees: number) => Math.round(rupees * 100);

function quote(key: string, token: number, at: string, last: number): MarketQuote {
  const time = ist(at);
  return {
    key, token, at: time, lastTradeAt: time, lastPrice: r(last), previousClose: r(last), open: r(last), high: r(last), low: r(last), volume: 1_000, oi: 10_000,
    bids: [{ price: r(last) - 10, quantity: 1_500, orders: 3 }],
    asks: [{ price: r(last) + 10, quantity: 1_500, orders: 3 }],
  };
}
const index = (at: string): MarketQuote => ({ ...quote("NSE:NIFTY 50", 256265, at, 24_900), volume: 0, oi: null, bids: [], asks: [] });

describe("account ticks", () => {
  const plan = findEvaluationPlan("10l")!;
  const opened = () => openDesk(plan, "ev-test", ist("2026-10-16 09:00"));

  it("asks for the account's contracts first, drops unknown keys and stays within one call", () => {
    const desk = { ...opened(), instruments: [contractInstrument(FUT)] };
    expect(tickKeys(desk, ["NSE:NIFTY 50", "NFO:NIFTY26OCTFUT", "bad key", "MCX:GOLD"])).toEqual(["NFO:NIFTY26OCTFUT", "NSE:NIFTY 50"]);
    const many = Array.from({ length: MAX_TICK_KEYS + 4 }, (_, i) => `NFO:NIFTY26OCT${24_000 + i * 50}CE`);
    expect(tickKeys(desk, many)).toHaveLength(MAX_TICK_KEYS);
    expect(tickKeys(desk, many)[0]).toBe("NFO:NIFTY26OCTFUT");
  });

  it("turns only futures and options quotes into books, stamped with the exchange time", () => {
    const books = engineBooks([quote("NFO:NIFTY26OCTFUT", FUT.token, "2026-10-16 10:00:01", 25_000), index("2026-10-16 10:00:01")]);
    expect([...books.keys()]).toEqual([FUT.token]);
    expect(books.get(FUT.token)).toMatchObject({ at: ist("2026-10-16 10:00:01"), lastPrice: r(25_000), asks: [{ price: r(25_000) + 10, quantity: 1_500 }] });
  });

  it("fills an order against a fresh quote, then marks it and squares off at 15:20 on later ticks", () => {
    const placed = applyOrder(opened(), contractInstrument(FUT), { id: "O1", token: FUT.token, side: "BUY", lots: 1, type: "MARKET" }, [quote("NFO:NIFTY26OCTFUT", FUT.token, "2026-10-16 10:00:00", 25_000)], ist("2026-10-16 10:00:01"));
    expect(placed.outputs.map((output) => output.kind)).toEqual(["accepted", "fill"]);
    expect(placed.desk.state.positions).toHaveLength(1);

    const marked = applyTick(placed.desk, [quote("NFO:NIFTY26OCTFUT", FUT.token, "2026-10-16 11:00:00", 25_100), index("2026-10-16 11:00:00")], ist("2026-10-16 11:00:01"));
    expect(marked.state.positions[0].mark).toBe(r(25_100));

    const squared = applyTick(marked, [quote("NFO:NIFTY26OCTFUT", FUT.token, "2026-10-16 15:20:00", 25_050)], ist("2026-10-16 15:20:01"));
    expect(squared.state.positions).toEqual([]);
    expect(squared.fills[0]).toMatchObject({ reason: "SQUARE_OFF", side: "SELL", quantity: 75 });
    expect(squared.instruments).toEqual([]);
  });

  it("refuses an order when the only quote is stale", () => {
    const stale = applyOrder(opened(), contractInstrument(FUT), { id: "O1", token: FUT.token, side: "BUY", lots: 1, type: "MARKET" }, [quote("NFO:NIFTY26OCTFUT", FUT.token, "2026-10-16 09:50:00", 25_000)], ist("2026-10-16 10:00:00"));
    expect(stale.outputs).toEqual([expect.objectContaining({ kind: "rejected", reason: "STALE_QUOTE" })]);
  });

  it("moves a working order against a fresh quote and fills it once marketable", () => {
    const placed = applyOrder(opened(), contractInstrument(FUT), { id: "L1", token: FUT.token, side: "BUY", lots: 1, type: "LIMIT", limitPrice: r(24_900) }, [quote("NFO:NIFTY26OCTFUT", FUT.token, "2026-10-16 10:00:00", 25_000)], ist("2026-10-16 10:00:01"));
    expect(placed.desk.state.orders).toHaveLength(1);
    const later = [quote("NFO:NIFTY26OCTFUT", FUT.token, "2026-10-16 10:05:00", 25_000)];
    const moved = applyModify(placed.desk, "L1", { limitPrice: r(25_000) + 10 }, later, ist("2026-10-16 10:05:01"));
    expect(moved.outputs.map((output) => output.kind)).toEqual(["modified", "fill"]);
    expect(moved.desk.orderBook?.[0]).toMatchObject({ id: "L1", status: "COMPLETE", limitPrice: r(25_000) + 10, averagePrice: r(25_000) + 10 });
    expect(applyModify(moved.desk, "L1", { limitPrice: r(24_950) }, later, ist("2026-10-16 10:05:02")).outputs).toEqual([expect.objectContaining({ kind: "rejected", reason: "UNKNOWN_ORDER" })]);
  });

  it("sets and moves a held option's stop-loss and target against a fresh quote", () => {
    const CALL: KiteContract = { ...FUT, token: 13238800, tradingSymbol: "NIFTY26OCT25000CE", kind: "CE", strike: r(25_000), tickSize: 5 };
    const at = (time: string) => quote("NFO:NIFTY26OCT25000CE", CALL.token, `2026-10-16 ${time}`, 120);
    const bought = applyOrder(opened(), contractInstrument(CALL), { id: "O1", token: CALL.token, side: "BUY", lots: 2, type: "MARKET" }, [at("10:00:00")], ist("2026-10-16 10:00:01")).desk;
    // The quote from 10:00 is a minute old by now: the fresh one comes with the change.
    const set = applyExits(bought, CALL.token, { stop: r(100), target: r(150) }, [at("10:01:00")], ist("2026-10-16 10:01:01"), "X1");
    expect(set.outputs.map((output) => output.kind)).toEqual(["accepted", "accepted"]);
    expect(set.desk.state.orders.map((order) => [order.id, order.quantity])).toEqual([["X1-SL", 150], ["X1-TP", 150]]);
    const moved = applyExits(set.desk, CALL.token, { stop: r(110), target: null }, [at("10:02:00")], ist("2026-10-16 10:02:01"), "X2");
    expect(moved.outputs.map((output) => output.kind)).toEqual(["modified", "cancelled"]);
    expect(moved.desk.state.orders.map((order) => [order.id, order.triggerPrice])).toEqual([["X1-SL", r(110)]]);
  });

  describe("trading policy", () => {
    const CALL: KiteContract = { ...FUT, token: 13238800, tradingSymbol: "NIFTY26OCT25000CE", kind: "CE", strike: r(25_000), tickSize: 5 };
    const PUT: KiteContract = { ...CALL, token: 13238801, tradingSymbol: "NIFTY26OCT25000PE", kind: "PE" };
    const BANK_PUT: KiteContract = { ...PUT, token: 13238900, tradingSymbol: "BANKNIFTY26OCT56000PE", underlying: "BANKNIFTY", strike: r(56_000) };
    const buy = (desk: ReturnType<typeof opened>, contract: KiteContract, lots = 1, type: "MARKET" | "LIMIT" = "MARKET") =>
      applyOrder(desk, contractInstrument(contract), { id: `O${contract.token}${type}`, token: contract.token, side: "BUY", lots, type, ...(type === "LIMIT" ? { limitPrice: r(100) } : {}) }, [quote(`NFO:${contract.tradingSymbol}`, contract.token, "2026-10-16 10:00:00", 120)], ist("2026-10-16 10:00:01")).desk;

    it("buys calls and puts, and sells only to close what is held", () => {
      const desk = opened();
      expect(orderPolicyProblem(desk, contractInstrument(CALL), "BUY", 1)).toBeNull();
      expect(orderPolicyProblem(desk, contractInstrument(CALL), "SELL", 1)).toBe("Sell only to close an option you hold: short options aren't allowed.");
      const long = buy(desk, CALL, 2);
      expect(orderPolicyProblem(long, contractInstrument(CALL), "SELL", 2)).toBeNull();
      expect(orderPolicyProblem(long, contractInstrument(CALL), "SELL", 3)).toBe("Sell only to close an option you hold: short options aren't allowed.");
      expect(orderPolicyProblem(long, contractInstrument(CALL), "BUY", 1)).toBeNull();
    });

    it("bets one direction per index, including working buys", () => {
      const long = buy(opened(), CALL);
      expect(orderPolicyProblem(long, contractInstrument(PUT), "BUY", 1)).toBe("Directional bets only: you hold NIFTY calls, so close them before buying puts.");
      expect(orderPolicyProblem(long, contractInstrument(BANK_PUT), "BUY", 1)).toBeNull();
      const working = buy(opened(), PUT, 1, "LIMIT");
      expect(working.state.orders).toHaveLength(1);
      expect(orderPolicyProblem(working, contractInstrument(CALL), "BUY", 1)).toBe("Directional bets only: you hold NIFTY puts, so close them before buying calls.");
    });

    it("doesn't hedge across the trader's accounts", () => {
      const other = buy(opened(), CALL);
      expect(orderPolicyProblem(opened(), contractInstrument(PUT), "BUY", 1, [other])).toBe("No hedging across accounts: another of your accounts holds NIFTY calls.");
      expect(orderPolicyProblem(opened(), contractInstrument(CALL), "BUY", 1, [other])).toBeNull();
    });

    it("trades options only, though a futures position can still be closed", () => {
      const desk = opened();
      expect(orderPolicyProblem(desk, contractInstrument(FUT), "BUY", 1)).toBe("Only options can be traded.");
      const long = applyOrder(desk, contractInstrument(FUT), { id: "O1", token: FUT.token, side: "BUY", lots: 2, type: "MARKET" }, [quote("NFO:NIFTY26OCTFUT", FUT.token, "2026-10-16 10:00:00", 25_000)], ist("2026-10-16 10:00:01")).desk;
      expect(orderPolicyProblem(long, contractInstrument(FUT), "SELL", 2)).toBeNull();
      expect(orderPolicyProblem(long, contractInstrument(FUT), "SELL", 3)).toBe("Only options can be traded.");
      expect(orderPolicyProblem(long, contractInstrument(FUT), "BUY", 1)).toBe("Only options can be traded.");
    });
  });

  it("sends full depth only for the contracts on screen", () => {
    const deep = (key: string, token: number) => ({ ...quote(key, token, "2026-10-16 10:00:00", 120), bids: [1, 2, 3].map((step) => ({ price: r(120) - step * 5, quantity: 75, orders: 1 })), asks: [1, 2, 3].map((step) => ({ price: r(120) + step * 5, quantity: 75, orders: 1 })) });
    const [charted, chain] = screenQuotes([deep("NFO:A", 1), deep("NFO:B", 2)], new Set(["NFO:A"]));
    expect([charted.bids.length, charted.asks.length]).toEqual([3, 3]);
    expect([chain.bids.length, chain.asks.length]).toEqual([1, 1]);
    expect(chain.bids[0].price).toBe(r(120) - 5);
  });
});
