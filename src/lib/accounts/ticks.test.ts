import { describe, expect, it } from "vitest";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { openDesk } from "@/lib/trading/desk";
import { ist } from "@/lib/trading/time";
import { contractInstrument, type KiteContract, type MarketQuote } from "@/lib/zerodha/kite";
import { applyOrder, applyTick, engineBooks, MAX_TICK_KEYS, tickKeys } from "./ticks";

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
    const many = Array.from({ length: 12 }, (_, i) => `NFO:NIFTY26OCT${24_000 + i * 50}CE`);
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
});
