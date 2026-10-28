import { describe, expect, it } from "vitest";
import { findEvaluationPlan } from "../prop-firm";
import { chartLines, dayPositions, dayTotals, deskQuoteKeys, deskStep, exitRole, exitsProblem, openDesk, positionExits, positionExitsProblem, setPositionExits, type Bracket, type Desk, type ExitChanges, type Exits } from "./desk";
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

describe("stop-loss and target", () => {
  const plan = findEvaluationPlan("5l")!;
  const day = "2026-11-02";
  const at = (time: string) => ist(`${day} ${time}`);
  const quote = (time: string, last: number) => optionQuote(CALL.token, `${day} ${time}`, last);
  const quoteWithAskQuantity = (time: string, last: number, askQuantity: number) => ({
    ...quote(time, last),
    asks: [{ price: r(last) + 5, quantity: askQuantity }],
  });
  const working = (desk: Desk) => desk.state.orders.map((order) => [order.id, order.type, order.side, order.quantity, order.triggerPrice ?? order.limitPrice]);
  const status = (desk: Desk) => Object.fromEntries(desk.orderBook!.map((record) => [record.id, record.reason ? `${record.status}: ${record.reason}` : record.status]));

  /** A market buy of calls around ₹120, with a stop-loss and target. */
  function bought(lots = 1, exits: Exits = { stop: r(100), target: r(150) }) {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-b", at("09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: at("09:30"), quote: quote("09:30", 120) }).desk;
    desk = deskStep(desk, { kind: "place", at: at("09:30"), order: { id: "E1", token: CALL.token, side: "BUY", lots, type: "MARKET" } }, quotes, CALL, exits).desk;
    return { quotes, desk };
  }

  it("places both exits for the filled lots as soon as the buy fills", () => {
    const { desk } = bought(2);
    expect(working(desk)).toEqual([["E1-SL", "SL-M", "SELL", 150, r(100)], ["E1-TP", "LIMIT", "SELL", 150, r(150)]]);
    expect(positionExits(desk, CALL.token)).toMatchObject({ stop: { id: "E1-SL" }, target: { id: "E1-TP" } });
    // The buy has filled, so nothing is left to cancel when an exit fills: the exits carry on alone.
    expect(desk.brackets).toBeUndefined();
    expect(desk.notes[0].text).toBe("Working a stop-loss at ₹100.00 and a target at ₹150.00 for 2 lots of NIFTY-25000-CE-TEST.");
    expect([exitRole("E1-SL"), exitRole("E1-TP"), exitRole("E1")]).toEqual(["stop", "target", null]);
    expect(riskMeters(desk.state).lotsInUse).toBe(2);
  });

  it("protects a partial entry immediately and grows exits as the remaining entry fills", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-partial", at("09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: at("09:30"), quote: quoteWithAskQuantity("09:30", 120, CALL.lotSize) }).desk;
    desk = deskStep(desk, { kind: "place", at: at("09:30"), order: { id: "E1", token: CALL.token, side: "BUY", lots: 2, type: "MARKET" } }, quotes, CALL, { stop: r(100), target: r(150) }).desk;

    expect(desk.state.orders.find((order) => order.id === "E1")).toMatchObject({ quantity: CALL.lotSize * 2, filled: CALL.lotSize });
    expect(working(desk)).toEqual([["E1", "MARKET", "BUY", 150, undefined], ["E1-SL", "SL-M", "SELL", 75, r(100)], ["E1-TP", "LIMIT", "SELL", 75, r(150)]]);
    expect(desk.brackets).toEqual([{ entryId: "E1", token: CALL.token, stop: r(100), target: r(150), status: "ACTIVE" }]);

    desk = drive(desk, quotes, { kind: "quote", at: at("09:45"), quote: quoteWithAskQuantity("09:45", 121, CALL.lotSize) }).desk;
    expect(desk.orderBook?.find((record) => record.id === "E1")).toMatchObject({ quantity: CALL.lotSize * 2, filled: CALL.lotSize * 2, status: "COMPLETE" });
    expect(working(desk)).toEqual([["E1-SL", "SL-M", "SELL", 150, r(100)], ["E1-TP", "LIMIT", "SELL", 150, r(150)]]);
  });

  it("cancels an entry remainder when a partial position's exit triggers", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-remainder", at("09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: at("09:30"), quote: quoteWithAskQuantity("09:30", 120, CALL.lotSize) }).desk;
    desk = deskStep(desk, { kind: "place", at: at("09:30"), order: { id: "E1", token: CALL.token, side: "BUY", lots: 2, type: "MARKET" } }, quotes, CALL, { stop: r(100), target: r(150) }).desk;

    desk = drive(desk, quotes, { kind: "quote", at: at("10:00"), quote: quoteWithAskQuantity("10:00", 99, 0) }).desk;
    expect(desk.state.positions).toEqual([]);
    expect(desk.state.orders).toEqual([]);
    expect(desk.brackets).toBeUndefined();
    expect(status(desk)).toMatchObject({ E1: "CANCELLED: Stop-loss hit", "E1-SL": "COMPLETE", "E1-TP": "CANCELLED: Stop-loss hit" });
    expect(desk.notes.map((note) => note.text)).toContain("Entry remainder on NIFTY-25000-CE-TEST cancelled: stop-loss hit.");
    expect(desk.fills[0]).toMatchObject({ side: "SELL", quantity: CALL.lotSize, orderId: "E1-SL" });
  });

  it("cancels the target when the stop-loss fills", () => {
    const { quotes, desk: opened } = bought();
    let desk = opened;
    desk = drive(desk, quotes, { kind: "quote", at: at("10:00"), quote: quote("10:00", 99) }).desk;
    expect(desk.state.positions).toEqual([]);
    expect(desk.state.orders).toEqual([]);
    expect(desk.brackets).toBeUndefined();
    expect(status(desk)).toEqual({ E1: "COMPLETE", "E1-SL": "COMPLETE", "E1-TP": "CANCELLED: Stop-loss hit" });
    expect(desk.fills[0]).toMatchObject({ side: "SELL", quantity: 75, orderId: "E1-SL" });
    expect(desk.notes[0].text).toBe("Target on NIFTY-25000-CE-TEST cancelled: stop-loss hit.");
  });

  it("cancels the stop-loss when the target fills, at the target", () => {
    const { quotes, desk: opened } = bought();
    let desk = opened;
    desk = drive(desk, quotes, { kind: "quote", at: at("10:00"), quote: quote("10:00", 152) }).desk;
    expect(desk.state.positions).toEqual([]);
    expect(status(desk)).toEqual({ E1: "COMPLETE", "E1-SL": "CANCELLED: Target hit", "E1-TP": "COMPLETE" });
    expect(desk.fills[0]).toMatchObject({ side: "SELL", quantity: 75, price: r(150), orderId: "E1-TP" });
  });

  it("cancels both when the position is closed by hand", () => {
    const { quotes, desk: opened } = bought();
    let desk = opened;
    desk = drive(desk, quotes, { kind: "quote", at: at("10:00"), quote: quote("10:00", 125) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: at("10:00"), order: { id: "X1", token: CALL.token, side: "SELL", lots: 1, type: "MARKET" } }, CALL).desk;
    expect(desk.state.orders).toEqual([]);
    expect(desk.brackets).toBeUndefined();
    expect(status(desk)).toMatchObject({ X1: "COMPLETE", "E1-SL": "CANCELLED: Position closed", "E1-TP": "CANCELLED: Position closed" });
  });

  it("trims both exits to what's left when part of the position is sold", () => {
    const { quotes, desk: opened } = bought(2);
    let desk = opened;
    desk = drive(desk, quotes, { kind: "quote", at: at("10:00"), quote: quote("10:00", 125) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: at("10:00"), order: { id: "X1", token: CALL.token, side: "SELL", lots: 1, type: "MARKET" } }, CALL).desk;
    expect(working(desk)).toEqual([["E1-SL", "SL-M", "SELL", 75, r(100)], ["E1-TP", "LIMIT", "SELL", 75, r(150)]]);
    desk = drive(desk, quotes, { kind: "quote", at: at("10:30"), quote: quote("10:30", 98) }).desk;
    expect(desk.state.positions).toEqual([]);
    expect(desk.fills[0]).toMatchObject({ quantity: 75, orderId: "E1-SL" });
    expect(status(desk)["E1-TP"]).toBe("CANCELLED: Stop-loss hit");
  });

  it("waits for a limit buy to fill, and forgets the exits of a buy cancelled unfilled", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-b", at("09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: at("09:30"), quote: quote("09:30", 120) }).desk;
    desk = deskStep(desk, { kind: "place", at: at("09:30"), order: { id: "L1", token: CALL.token, side: "BUY", lots: 1, type: "LIMIT", limitPrice: r(110) } }, quotes, CALL, { stop: r(100), target: r(140) }).desk;
    desk = deskStep(desk, { kind: "place", at: at("09:30"), order: { id: "L2", token: CALL.token, side: "BUY", lots: 1, type: "LIMIT", limitPrice: r(105) } }, quotes, CALL, { stop: r(95) }).desk;
    expect(desk.brackets?.map((bracket) => [bracket.entryId, bracket.status])).toEqual([["L1", "WAITING"], ["L2", "WAITING"]]);
    desk = drive(desk, quotes, { kind: "cancel", at: at("09:40"), orderId: "L2" }).desk;
    expect(desk.brackets?.map((bracket) => bracket.entryId)).toEqual(["L1"]);
    desk = drive(desk, quotes, { kind: "quote", at: at("09:45"), quote: quote("09:45", 108) }).desk;
    expect(working(desk)).toEqual([["L1-SL", "SL-M", "SELL", 75, r(100)], ["L1-TP", "LIMIT", "SELL", 75, r(140)]]);
    expect(desk.fills[0]).toMatchObject({ side: "BUY", price: r(110), orderId: "L1" });
  });

  it("says when the market has already passed the stop-loss, and still works the target", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-b", at("09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: at("09:30"), quote: quote("09:30", 140) }).desk;
    desk = deskStep(desk, { kind: "place", at: at("09:30"), order: { id: "L1", token: CALL.token, side: "BUY", lots: 1, type: "LIMIT", limitPrice: r(130) } }, quotes, CALL, { stop: r(120), target: r(160) }).desk;
    desk = drive(desk, quotes, { kind: "quote", at: at("09:45"), quote: quote("09:45", 115) }).desk;
    expect(working(desk)).toEqual([["L1-TP", "LIMIT", "SELL", 75, r(160)]]);
    expect(desk.notes.map((note) => note.text)).toContain("Stop-loss not placed: The market is already through this trigger price.");
    expect(desk.notes.some((note) => note.text.startsWith("Order rejected"))).toBe(false);
    expect(positionExits(desk, CALL.token)).toEqual({ target: expect.objectContaining({ id: "L1-TP" }) });
    expect(desk.brackets).toBeUndefined();
  });

  it("goes with everything else at the 15:20 square-off", () => {
    const { quotes, desk: opened } = bought();
    let desk = opened;
    desk = drive(desk, quotes, { kind: "clock", at: at("15:21") }).desk;
    expect(desk.state.positions).toEqual([]);
    expect(desk.brackets).toBeUndefined();
    expect(status(desk)).toMatchObject({ "E1-SL": "CANCELLED: 15:20 square-off", "E1-TP": "CANCELLED: 15:20 square-off" });
  });

  it("survives a JSON round trip with exits working", () => {
    const { desk, quotes } = bought();
    const stored: Desk = JSON.parse(JSON.stringify(desk));
    const next = { kind: "quote", at: at("10:00"), quote: quote("10:00", 99) } as const;
    expect(drive(stored, new Map(quotes), next).desk).toEqual(drive(desk, new Map(quotes), next).desk);
  });

  it("marks the average price, the stop-loss and the target on the chart", () => {
    const { desk, quotes } = bought(2);
    expect(chartLines(desk, CALL.token)).toEqual([
      { price: r(120.10), title: "Avg +150", tone: "average", quantity: 150 },
      { price: r(100), title: "SL", tone: "stop", orderId: "E1-SL", quantity: 150 },
      { price: r(150), title: "TP", tone: "target", orderId: "E1-TP", quantity: 150 },
    ]);
    expect(chartLines(desk, PUT.token)).toEqual([]);
    const quoted = drive(desk, quotes, { kind: "quote", at: at("09:31"), quote: quote("09:31", 121) }).desk;
    const limit = deskStep(quoted, { kind: "place", at: at("09:31"), order: { id: "L9", token: CALL.token, side: "SELL", lots: 1, type: "LIMIT", limitPrice: r(160) } }, quotes, CALL).desk;
    expect(chartLines(limit, CALL.token).at(-1)).toEqual({ price: r(160), title: "Sell LIMIT", tone: "order", orderId: "L9", quantity: 75 });
  });

  it("checks a stop-loss and target against the buy's price and tick", () => {
    expect(exitsProblem({}, "BUY", r(120), 5)).toBeNull();
    expect(exitsProblem({ stop: r(100), target: r(150) }, "BUY", r(120), 5)).toBeNull();
    expect(exitsProblem({ target: r(150) }, "BUY", undefined, 5)).toBeNull();
    expect(exitsProblem({ stop: r(100) }, "SELL", r(120), 5)).toBe("A stop-loss and target go with a buy.");
    expect(exitsProblem({ stop: r(100.03) }, "BUY", r(120), 5)).toBe("Use prices in multiples of ₹0.05.");
    expect(exitsProblem({ stop: r(130), target: r(125) }, "BUY", undefined, 5)).toBe("Set the stop-loss below the target.");
    expect(exitsProblem({ stop: r(120) }, "BUY", r(120), 5)).toBe("Set the stop-loss below ₹120.00.");
    expect(exitsProblem({ target: r(119.95) }, "BUY", r(120), 5)).toBe("Set the target above ₹120.00.");
  });
});

describe("stop-loss and target after the buy", () => {
  const plan = findEvaluationPlan("5l")!;
  const day = "2026-11-02";
  const at = (time: string) => ist(`${day} ${time}`);
  const quote = (time: string, last: number) => optionQuote(CALL.token, `${day} ${time}`, last);
  const working = (desk: Desk) => desk.state.orders.map((order) => [order.id, order.type, order.side, order.quantity, order.triggerPrice ?? order.limitPrice]);
  const status = (desk: Desk) => Object.fromEntries(desk.orderBook!.map((record) => [record.id, record.reason ? `${record.status}: ${record.reason}` : record.status]));

  /** Calls bought at market around ₹120, without a stop-loss or target. */
  function held(lots = 2) {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-x", at("09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: at("09:30"), quote: quote("09:30", 120) }).desk;
    desk = drive(desk, quotes, { kind: "place", at: at("09:30"), order: { id: "E1", token: CALL.token, side: "BUY", lots, type: "MARKET" } }, CALL).desk;
    return { quotes, desk };
  }

  /** New exits at `time`, on a fresh quote at `last`, as the platform sends them. */
  function setAt(desk: Desk, quotes: Map<number, Quote>, time: string, last: number, changes: ExitChanges, id: string) {
    const marked = drive(desk, quotes, { kind: "quote", at: at(time), quote: quote(time, last) }).desk;
    return setPositionExits(marked, CALL.token, changes, id, at(time), quotes);
  }

  it("sets both on a position bought without them, for the whole position", () => {
    const { quotes, desk } = held();
    expect(desk.state.orders).toEqual([]);
    const set = setAt(desk, quotes, "09:40", 125, { stop: r(110), target: r(150) }, "X1");
    expect(set.outputs.map((output) => output.kind)).toEqual(["accepted", "accepted"]);
    expect(working(set.desk)).toEqual([["X1-SL", "SL-M", "SELL", 150, r(110)], ["X1-TP", "LIMIT", "SELL", 150, r(150)]]);
    expect(set.desk.notes[0].text).toBe("Working a stop-loss at ₹110.00 and a target at ₹150.00 for 2 lots of NIFTY-25000-CE-TEST.");
    expect(set.desk.brackets).toBeUndefined();
    expect(chartLines(set.desk, CALL.token).map((line) => [line.title, line.orderId])).toEqual([["Avg +150", undefined], ["SL", "X1-SL"], ["TP", "X1-TP"]]);
  });

  it("moves, removes and adds one at a time, under new ids", () => {
    const { quotes, desk: bought } = held();
    let desk = setAt(bought, quotes, "09:40", 125, { stop: r(110), target: r(150) }, "X1").desk;

    desk = setAt(desk, quotes, "09:45", 128, { stop: r(118) }, "X2").desk;
    expect(working(desk)).toEqual([["X1-SL", "SL-M", "SELL", 150, r(118)], ["X1-TP", "LIMIT", "SELL", 150, r(150)]]);
    expect(desk.notes[0].text).toBe("Stop-loss on NIFTY-25000-CE-TEST moved to ₹118.00.");
    expect(desk.orderBook?.find((record) => record.id === "X1-SL")).toMatchObject({ status: "OPEN", triggerPrice: r(118) });

    desk = setAt(desk, quotes, "09:50", 130, { target: null }, "X3").desk;
    expect(working(desk)).toEqual([["X1-SL", "SL-M", "SELL", 150, r(118)]]);
    expect(desk.notes[0].text).toBe("Target on NIFTY-25000-CE-TEST removed.");
    expect(status(desk)["X1-TP"]).toBe("CANCELLED: Cancelled by you");

    desk = setAt(desk, quotes, "09:55", 131, { target: r(160) }, "X4").desk;
    expect(working(desk)).toEqual([["X1-SL", "SL-M", "SELL", 150, r(118)], ["X4-TP", "LIMIT", "SELL", 150, r(160)]]);
    expect(desk.notes[0].text).toBe("Working a target at ₹160.00 for 2 lots of NIFTY-25000-CE-TEST.");
  });

  it("works one-cancels-other and follows the position, like exits set with the buy", () => {
    const { quotes, desk: bought } = held();
    let desk = setAt(bought, quotes, "09:40", 125, { stop: r(110), target: r(150) }, "X1").desk;
    desk = drive(desk, quotes, { kind: "place", at: at("09:40"), order: { id: "S1", token: CALL.token, side: "SELL", lots: 1, type: "MARKET" } }, CALL).desk;
    expect(working(desk)).toEqual([["X1-SL", "SL-M", "SELL", 75, r(110)], ["X1-TP", "LIMIT", "SELL", 75, r(150)]]);
    desk = drive(desk, quotes, { kind: "quote", at: at("10:10"), quote: quote("10:10", 109) }).desk;
    expect(desk.state.positions).toEqual([]);
    expect(desk.fills[0]).toMatchObject({ side: "SELL", quantity: 75, orderId: "X1-SL" });
    expect(status(desk)).toMatchObject({ "X1-SL": "COMPLETE", "X1-TP": "CANCELLED: Stop-loss hit" });
    expect(desk.state.orders).toEqual([]);
  });

  it("cancels the stop-loss when a moved target fills at once", () => {
    const { quotes, desk: bought } = held(1);
    const desk = setAt(bought, quotes, "09:40", 125, { stop: r(110), target: r(150) }, "X1").desk;
    // Below the best bid, the target fills straight away (the platform checks for this first).
    const sold = setAt(desk, quotes, "09:41", 125, { target: r(124) }, "X2");
    expect(sold.desk.fills[0]).toMatchObject({ side: "SELL", quantity: 75, price: r(124.95), orderId: "X1-TP" });
    expect(status(sold.desk)).toMatchObject({ "X1-TP": "COMPLETE", "X1-SL": "CANCELLED: Target hit" });
    expect(sold.desk.state.positions).toEqual([]);
  });

  it("keeps one stop-loss and one target when another buy brings its own", () => {
    const { quotes, desk: bought } = held(1);
    let desk = setAt(bought, quotes, "09:40", 125, { stop: r(105), target: r(150) }, "X1").desk;
    desk = deskStep(desk, { kind: "place", at: at("09:40"), order: { id: "E2", token: CALL.token, side: "BUY", lots: 1, type: "MARKET" } }, quotes, CALL, { stop: r(112) }).desk;
    // The new buy's stop-loss replaces the position's; its target stays; both now cover both lots.
    expect(working(desk)).toEqual([["X1-SL", "SL-M", "SELL", 150, r(112)], ["X1-TP", "LIMIT", "SELL", 150, r(150)]]);
    expect(desk.notes[0].text).toBe("Stop-loss on NIFTY-25000-CE-TEST moved to ₹112.00.");
    expect(desk.brackets).toBeUndefined();
  });

  it("says why an exit wasn't placed or moved", () => {
    const { quotes, desk } = held();
    // Prices from 09:30 are stale at 09:41, so orders are paused.
    const stale = setPositionExits(desk, CALL.token, { stop: r(110) }, "X1", at("09:41"), quotes);
    expect(stale.outputs).toEqual([expect.objectContaining({ kind: "rejected", reason: "STALE_QUOTE" })]);
    expect(stale.desk.notes[0].text).toBe("Stop-loss not placed: Prices for this contract are delayed, so new orders are paused.");
    expect(stale.desk.state.orders).toEqual([]);

    const set = setAt(desk, quotes, "09:45", 125, { stop: r(110) }, "X2").desk;
    const crossed = setAt(set, quotes, "09:46", 125, { stop: r(126) }, "X3");
    expect(crossed.desk.notes[0].text).toBe("Stop-loss not moved: The market is already through this trigger price.");
    expect(working(crossed.desk)).toEqual([["X2-SL", "SL-M", "SELL", 150, r(110)]]);
  });

  it("leaves a contract that isn't held alone", () => {
    const { quotes, desk } = held();
    const put = setPositionExits(desk, PUT.token, { stop: r(10) }, "X1", at("09:30"), quotes);
    expect(put.outputs).toEqual([]);
    expect(put.desk.state.orders).toEqual([]);
  });

  it("checks new exits against the position, the last price and each other", () => {
    const { quotes, desk: bought } = held(1);
    const desk = setAt(bought, quotes, "09:40", 125, { stop: r(110), target: r(150) }, "X1").desk;
    expect(positionExitsProblem(desk, PUT.token, { stop: r(80) }, r(90))).toBe("You don't hold this option.");
    expect(positionExitsProblem(desk, CALL.token, { stop: r(115) }, r(125))).toBeNull();
    expect(positionExitsProblem(desk, CALL.token, { stop: r(115.02) }, r(125))).toBe("Use prices in multiples of ₹0.05.");
    expect(positionExitsProblem(desk, CALL.token, { stop: r(125) }, r(125))).toBe("Set the stop-loss below ₹125.00.");
    expect(positionExitsProblem(desk, CALL.token, { target: r(124.95) }, r(125))).toBe("Set the target above ₹125.00.");
    // Against the target that is working, unless it goes too.
    expect(positionExitsProblem(desk, CALL.token, { stop: r(155) }, r(160))).toBe("Set the stop-loss below the target.");
    expect(positionExitsProblem(desk, CALL.token, { stop: r(155), target: null }, r(160))).toBeNull();
    expect(positionExitsProblem(desk, CALL.token, { stop: r(140), target: r(135) }, undefined)).toBe("Set the stop-loss below the target.");
    // An exit left as it is isn't checked against the price, even when the market has passed it.
    expect(positionExitsProblem(desk, CALL.token, { stop: r(140) }, r(151))).toBeNull();
    expect(positionExitsProblem(desk, CALL.token, { stop: null, target: null }, r(125))).toBeNull();
  });

  it("keeps exits working on desks stored before position exits", () => {
    const { quotes, desk: opened } = held(1);
    let desk = setAt(opened, quotes, "09:40", 125, { stop: r(110), target: r(150) }, "E1").desk;
    // The old shape: a filled buy's bracket that names its two exits.
    desk = { ...desk, brackets: [{ entryId: "E1", token: CALL.token, stop: r(110), target: r(150), status: "ACTIVE", stopOrderId: "E1-SL", targetOrderId: "E1-TP" } as Bracket] };
    desk = JSON.parse(JSON.stringify(desk));
    desk = drive(desk, quotes, { kind: "quote", at: at("10:00"), quote: quote("10:00", 152) }).desk;
    expect(status(desk)).toMatchObject({ "E1-TP": "COMPLETE", "E1-SL": "CANCELLED: Target hit" });
    expect(desk.brackets).toBeUndefined();
  });

  it("doesn't let another contract's quote cancel what's left of a buy", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, "desk-q", at("09:00"));
    desk = drive(desk, quotes, { kind: "quote", at: at("09:30"), quote: { ...quote("09:30", 120), asks: [{ price: r(120.05), quantity: CALL.lotSize }] } }).desk;
    desk = deskStep(desk, { kind: "place", at: at("09:30"), order: { id: "E1", token: CALL.token, side: "BUY", lots: 2, type: "MARKET" } }, quotes, CALL, { stop: r(100), target: r(150) }).desk;
    expect(desk.brackets).toEqual([expect.objectContaining({ entryId: "E1", status: "ACTIVE" })]);
    desk = drive(desk, quotes, { kind: "quote", at: at("09:31"), quote: optionQuote(PUT.token, `${day} 09:31`, 40) }).desk;
    expect(desk.state.orders.map((order) => order.id)).toEqual(["E1", "E1-SL", "E1-TP"]);
  });
});
