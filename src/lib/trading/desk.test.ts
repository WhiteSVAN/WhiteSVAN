import { describe, expect, it } from "vitest";
import { findEvaluationPlan } from "../prop-firm";
import { dayPositions, dayTotals, deskQuoteKeys, deskStep, openDesk, type Desk } from "./desk";
import { riskMeters, type EngineEvent } from "./engine";
import type { Instrument } from "./instruments";
import type { Quote } from "./matching";
import { ist } from "./time";

// Test fixtures, not exchange values.
const FUT: Instrument = { token: 101, exchange: "NFO", tradingSymbol: "NIFTY-FUT-TEST", underlying: "NIFTY", kind: "FUT", expiry: "2026-11-24", strike: null, lotSize: 50, tickSize: 10, freezeQuantity: 900 };
const r = (rupees: number) => Math.round(rupees * 100);
const quoteAt = (time: string, last: number): Quote => ({ token: FUT.token, at: ist(time), lastPrice: r(last), bids: [{ price: r(last) - 10, quantity: 5_000 }], asks: [{ price: r(last) + 10, quantity: 5_000 }] });
const CALL: Instrument = { token: 201, exchange: "NFO", tradingSymbol: "NIFTY-25000-CE-TEST", underlying: "NIFTY", kind: "CE", expiry: "2026-11-24", strike: r(25_000), lotSize: 75, tickSize: 5, freezeQuantity: 1_800 };
const PUT: Instrument = { ...CALL, token: 202, tradingSymbol: "NIFTY-25000-PE-TEST", kind: "PE" };
const optionQuote = (token: number, time: string, last: number): Quote => ({ token, at: ist(time), lastPrice: r(last), bids: [{ price: r(last) - 5, quantity: 5_000 }], asks: [{ price: r(last) + 5, quantity: 5_000 }] });

/** Drives a desk the way the browser host does: quotes first, then the event. */
function drive(desk: Desk, quotes: Map<number, Quote>, event: EngineEvent, instrument?: Instrument) {
  if (event.kind === "quote") quotes.set(event.quote.token, event.quote);
  return deskStep(desk, event, quotes, instrument);
}

describe("test desk host", () => {
  const plan = findEvaluationPlan("1l")!;

  it("opens an evaluation account on the plan's rules", () => {
    const desk = openDesk(plan, "desk-1", ist("2026-11-02 09:00"));
    expect(desk.state).toMatchObject({ status: "ACTIVE", phase: "EVALUATION", balance: r(1_00_000) });
    expect(desk.instruments).toEqual([]);
    expect(desk.notes[0].text).toBe("Opened a ₹1L demo account.");
  });

  it("opens a funded account on the same rules", () => {
    const desk = openDesk(plan, "desk-f", ist("2026-11-02 09:00"), "FUNDED");
    expect(desk.state).toMatchObject({ status: "ACTIVE", phase: "FUNDED", balance: r(1_00_000) });
    expect(desk.state.rules).toEqual(openDesk(plan, "desk-e", ist("2026-11-02 09:00")).state.rules);
    expect(desk.notes[0].text).toBe("Opened a ₹1L funded account.");
  });

  it("trades a round trip, logs fills and notes newest first, and forgets the contract once flat", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-1", ist("2026-11-02 09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: ist("2026-11-02 09:20"), quote: quoteAt("2026-11-02 09:20", 25_000) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist("2026-11-02 09:20"), order: { id: "O1", token: FUT.token, side: "BUY", lots: 1, type: "MARKET" } }, FUT).desk;
    expect(desk.instruments.map((item) => item.token)).toEqual([FUT.token]);
    expect(deskQuoteKeys(desk)).toEqual(["NFO:NIFTY-FUT-TEST"]);
    expect(desk.fills[0]).toMatchObject({ side: "BUY", quantity: 50, price: r(25_000) + 10 + 10 });

    desk = drive(desk, quotes, { kind: "quote", at: ist("2026-11-02 10:00"), quote: quoteAt("2026-11-02 10:00", 25_040) }).desk;
    const closed = drive(desk, quotes, { kind: "place", at: ist("2026-11-02 10:00"), order: { id: "O2", token: FUT.token, side: "SELL", lots: 1, type: "MARKET" } });
    desk = closed.desk;
    expect(desk.instruments).toEqual([]);
    expect(desk.fills.map((fill) => fill.side)).toEqual(["SELL", "BUY"]);
    expect(desk.fills[0].realised).toBe((r(25_040) - 10 - 10 - (r(25_000) + 20)) * 50);
    expect(desk.notes[0]).toMatchObject({ tone: "good" });
    expect(desk.notes[0].text).toMatch(/^Sold 50 NIFTY-FUT-TEST at ₹25,039\.80, realised ₹1,980\.00; charges ₹[\d,.]+\.$/);
    const meters = riskMeters(desk.state);
    expect(meters.balance).toBe(r(1_00_000) + desk.fills[0].realised - desk.fills[0].charges.total - desk.fills[1].charges.total);
  });

  it("keeps a working order's contract fresh and logs rejections", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-1", ist("2026-11-02 09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: ist("2026-11-02 09:30"), quote: quoteAt("2026-11-02 09:30", 25_000) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist("2026-11-02 09:30"), order: { id: "L1", token: FUT.token, side: "BUY", lots: 1, type: "LIMIT", limitPrice: r(24_900) } }, FUT).desk;
    expect(desk.state.orders.map((order) => order.id)).toEqual(["L1"]);
    expect(deskQuoteKeys(desk)).toEqual(["NFO:NIFTY-FUT-TEST"]);

    const late = drive(desk, quotes, { kind: "place", at: ist("2026-11-02 15:25"), order: { id: "L2", token: FUT.token, side: "BUY", lots: 1, type: "MARKET" } }, FUT);
    expect(late.desk.notes[0]).toMatchObject({ tone: "bad" });
    expect(late.desk.notes[0].text).toMatch(/^Order rejected: Orders are accepted from 09:15 to 15:20 IST/);
    expect(late.desk.notes.some((note) => note.text === "Order cancelled at the 15:20 square-off.")).toBe(true);
    expect(late.desk.instruments).toEqual([]);
  });

  it("keeps an order book from placement to fill, change, cancel and rejection", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-1", ist("2026-11-02 09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: ist("2026-11-02 09:20"), quote: quoteAt("2026-11-02 09:20", 25_000) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist("2026-11-02 09:20"), order: { id: "M1", token: FUT.token, side: "BUY", lots: 1, type: "MARKET" } }, FUT).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist("2026-11-02 09:20"), order: { id: "L1", token: FUT.token, side: "SELL", lots: 1, type: "LIMIT", limitPrice: r(25_100) } }, FUT).desk;
    desk = drive(desk, quotes, { kind: "modify", at: ist("2026-11-02 09:20"), orderId: "L1", changes: { limitPrice: r(25_150) } }).desk;
    expect(desk.notes[0].text).toBe("Order modified.");
    const refused = drive(desk, quotes, { kind: "modify", at: ist("2026-11-02 09:20"), orderId: "L1", changes: { limitPrice: r(25_150.03) } }).desk;
    expect(refused.notes[0].text).toMatch(/^Change refused: Use positive prices/);
    expect(refused.orderBook?.find((record) => record.id === "L1")?.status).toBe("OPEN");
    desk = drive(refused, quotes, { kind: "cancel", at: ist("2026-11-02 09:21"), orderId: "L1" }).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist("2026-11-02 15:25"), order: { id: "X1", token: FUT.token, side: "BUY", lots: 1, type: "MARKET" } }, FUT).desk;

    expect(desk.orderBook?.map((record) => [record.id, record.status])).toEqual([["X1", "REJECTED"], ["L1", "CANCELLED"], ["M1", "COMPLETE"]]);
    const [late, limit, market] = desk.orderBook!;
    expect(late.reason).toMatch(/^Orders are accepted from 09:15 to 15:20 IST/);
    expect(limit).toMatchObject({ side: "SELL", type: "LIMIT", limitPrice: r(25_150), quantity: 50, filled: 0, averagePrice: null, reason: "Cancelled by you" });
    expect(market).toMatchObject({ side: "BUY", type: "MARKET", quantity: 50, filled: 50, averagePrice: r(25_000) + 20, tradingSymbol: "NIFTY-FUT-TEST" });
    expect(desk.orderBook!.every((record) => record.limitPrice === undefined || record.type === "LIMIT")).toBe(true);
  });

  it("starts an order book for a desk stored before it existed", () => {
    const quotes = new Map<number, Quote>();
    const old = openDesk(plan, "desk-1", ist("2026-11-02 09:00"));
    delete old.orderBook;
    let desk: Desk = drive(old, quotes, { kind: "quote", at: ist("2026-11-02 09:20"), quote: quoteAt("2026-11-02 09:20", 25_000) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist("2026-11-02 09:20"), order: { id: "M1", token: FUT.token, side: "BUY", lots: 1, type: "MARKET" } }, FUT).desk;
    expect(desk.orderBook?.map((record) => record.status)).toEqual(["COMPLETE"]);
  });

  it("applies an event stamped before the account clock at the clock", () => {
    const quotes = new Map<number, Quote>();
    const desk = drive(openDesk(plan, "desk-1", ist("2026-11-02 09:00")), quotes, { kind: "clock", at: ist("2026-11-02 11:00") }).desk;
    expect(() => deskStep(desk, { kind: "clock", at: ist("2026-11-02 10:59") }, quotes)).not.toThrow();
    expect(deskStep(desk, { kind: "clock", at: ist("2026-11-02 10:59") }, quotes).desk.state.clock).toBe(ist("2026-11-02 11:00"));
  });

  it("survives a JSON round trip, as the browser stores it", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-1", ist("2026-11-02 09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: ist("2026-11-02 09:20"), quote: quoteAt("2026-11-02 09:20", 25_000) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist("2026-11-02 09:20"), order: { id: "O1", token: FUT.token, side: "BUY", lots: 1, type: "MARKET" } }, FUT).desk;
    const stored: Desk = JSON.parse(JSON.stringify(desk));
    const next = { kind: "quote", at: ist("2026-11-02 09:21"), quote: quoteAt("2026-11-02 09:21", 24_950) } as const;
    expect(drive(stored, new Map(quotes), next).desk).toEqual(drive(desk, new Map(quotes), next).desk);
  });
});

describe("day positions and trade counts", () => {
  const plan = findEvaluationPlan("1l")!;
  const day = "2026-11-02";

  /** Buy a call and sell it higher, and buy a put that stays open. */
  function tradeOptions() {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-2", ist(`${day} 09:00`));
    desk = drive(desk, quotes, { kind: "quote", at: ist(`${day} 09:30`), quote: optionQuote(CALL.token, `${day} 09:30`, 120) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist(`${day} 09:30`), order: { id: "C1", token: CALL.token, side: "BUY", lots: 1, type: "MARKET" } }, CALL).desk;
    desk = drive(desk, quotes, { kind: "quote", at: ist(`${day} 10:15`), quote: optionQuote(CALL.token, `${day} 10:15`, 140) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist(`${day} 10:15`), order: { id: "C2", token: CALL.token, side: "SELL", lots: 1, type: "MARKET" } }, CALL).desk;
    desk = drive(desk, quotes, { kind: "quote", at: ist(`${day} 11:00`), quote: optionQuote(PUT.token, `${day} 11:00`, 90) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: ist(`${day} 11:00`), order: { id: "P1", token: PUT.token, side: "BUY", lots: 1, type: "MARKET" } }, PUT).desk;
    desk = drive(desk, quotes, { kind: "quote", at: ist(`${day} 11:30`), quote: optionQuote(PUT.token, `${day} 11:30`, 80) }).desk;
    return desk;
  }

  it("counts the day's fills for the journal", () => {
    expect(tradeOptions().dayTrades).toEqual({ [day]: 3 });
  });

  it("shows open and closed options with their P&L, open ones first", () => {
    const desk = tradeOptions();
    const [put, call] = dayPositions(desk, day);
    // Market orders cross the 5-paise spread and pay one tick (5 paise) of slippage.
    expect(call).toMatchObject({ tradingSymbol: CALL.tradingSymbol, quantity: 0, buyQuantity: 75, buyValue: r(120.10) * 75, sellQuantity: 75, sellValue: r(139.90) * 75, realised: (r(139.90) - r(120.10)) * 75, unrealised: 0, mark: r(139.90), lotSize: null });
    expect(put).toMatchObject({ tradingSymbol: PUT.tradingSymbol, quantity: 75, averagePrice: r(90.10), mark: r(80), buyQuantity: 75, sellQuantity: 0, realised: 0, unrealised: (r(80) - r(90.10)) * 75, lotSize: 75 });
    expect(call.charges + put.charges).toBe(desk.fills.reduce((sum, fill) => sum + fill.charges.total, 0));
    expect(dayPositions(desk, "2026-11-03")).toEqual([put].map((position) => ({ ...position, buyQuantity: 0, buyValue: 0, realised: 0, charges: 0 })));
  });

  it("nets the day's P&L the way the account's balance does", () => {
    const desk = tradeOptions();
    const totals = dayTotals(dayPositions(desk, day));
    const meters = riskMeters(desk.state);
    expect(totals.net).toBe(meters.todayNet + meters.unrealised);
    expect(totals.realised - totals.charges).toBe(meters.todayNet);
    expect(totals.unrealised).toBe(meters.unrealised);
  });
});
