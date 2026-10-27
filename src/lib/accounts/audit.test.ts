import { describe, expect, it } from "vitest";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { deskStep, openDesk, type Desk } from "@/lib/trading/desk";
import type { EngineEvent, Fill } from "@/lib/trading/engine";
import type { Instrument } from "@/lib/trading/instruments";
import type { Quote } from "@/lib/trading/matching";
import { ist } from "@/lib/trading/time";
import { auditDelta, auditIsEmpty, eventRow, fillRow, refusalEvent } from "./audit";

// Test fixtures, not exchange values.
const r = (rupees: number) => Math.round(rupees * 100);
const CALL: Instrument = { token: 301, exchange: "NFO", tradingSymbol: "NIFTY-25000-CE-AUDIT", underlying: "NIFTY", kind: "CE", expiry: "2026-11-24", strike: r(25_000), lotSize: 75, tickSize: 5, freezeQuantity: 1_800 };
const quote = (time: string, last: number): Quote => ({ token: CALL.token, at: ist(time), lastPrice: r(last), bids: [{ price: r(last) - 5, quantity: 5_000 }], asks: [{ price: r(last) + 5, quantity: 5_000 }] });
const plan = findEvaluationPlan("1l")!;
const owner = { id: "acct-audit", userId: "user-audit" };

/**
 * One desk write: the event applied, and what it added to the audit. Like the platform's host, an
 * order goes in on a fresh quote (the engine refuses one more than 5 seconds old).
 */
function write(desk: Desk, quotes: Map<number, Quote>, event: EngineEvent, last = 120) {
  if (event.kind === "quote") quotes.set(event.quote.token, event.quote);
  else quotes.set(CALL.token, { ...quote("2026-11-02 09:00", last), at: event.at });
  const after = deskStep(desk, event, quotes, CALL).desk;
  return { after, delta: auditDelta(desk, after) };
}

describe("trade and activity audit", () => {
  it("records each order event and fill once, oldest first, as the desk writes happen", () => {
    const quotes = new Map<number, Quote>();
    let desk = openDesk(plan, owner.id, ist("2026-11-02 09:00"));
    desk = write(desk, quotes, { kind: "quote", at: ist("2026-11-02 09:20"), quote: quote("2026-11-02 09:20", 120) }).after;

    const placed = write(desk, quotes, { kind: "place", at: ist("2026-11-02 09:21"), order: { id: "L1", token: CALL.token, side: "BUY", lots: 1, type: "LIMIT", limitPrice: r(100) } });
    expect(placed.delta.fills).toEqual([]);
    expect(placed.delta.events).toEqual([{ key: "order:L1:placed", kind: "ORDER_PLACED", orderId: "L1", at: ist("2026-11-02 09:21"), detail: { tradingSymbol: CALL.tradingSymbol, token: CALL.token, side: "BUY", type: "LIMIT", lots: 1, quantity: 75, limitPrice: r(100), triggerPrice: null, exit: null, reason: null } }]);

    const modified = write(placed.after, quotes, { kind: "modify", at: ist("2026-11-02 09:22"), orderId: "L1", changes: { limitPrice: r(105) } });
    expect(modified.delta.events).toEqual([{ key: `order:L1:modified:${ist("2026-11-02 09:22")}`, kind: "ORDER_MODIFIED", orderId: "L1", at: ist("2026-11-02 09:22"), detail: { tradingSymbol: CALL.tradingSymbol, side: "BUY", type: "LIMIT", from: { lots: 1, limitPrice: r(100), triggerPrice: null }, to: { lots: 1, limitPrice: r(105), triggerPrice: null } } }]);

    const cancelled = write(modified.after, quotes, { kind: "cancel", at: ist("2026-11-02 09:23"), orderId: "L1" });
    expect(cancelled.delta.events).toMatchObject([{ key: "order:L1:cancelled", kind: "ORDER_CANCELLED", at: ist("2026-11-02 09:23"), detail: { filled: 0, quantity: 75 } }]);

    const bought = write(cancelled.after, quotes, { kind: "place", at: ist("2026-11-02 09:24"), order: { id: "B1", token: CALL.token, side: "BUY", lots: 1, type: "MARKET" } });
    expect(bought.delta.events.map((event) => event.key)).toEqual(["order:B1:placed"]);
    expect(bought.delta.fills).toHaveLength(1);
    expect(bought.delta.fills[0]).toMatchObject({ orderId: "B1", side: "BUY", quantity: 75, reason: "ORDER" });

    const rejected = write(bought.after, quotes, { kind: "place", at: ist("2026-11-02 09:25"), order: { id: "B2", token: CALL.token, side: "BUY", lots: 1, type: "MARKET" } });
    expect(rejected.delta.fills).toEqual([]);
    expect(rejected.delta.events).toMatchObject([{ key: "order:B2:rejected", kind: "ORDER_REJECTED", detail: { reason: expect.stringContaining("1-lot position limit") } }]);

    // A fall of ₹40 a unit on 75 units is past the ₹2,000 daily loss limit: breach, and the position is closed.
    const breached = write(rejected.after, quotes, { kind: "quote", at: ist("2026-11-02 10:00"), quote: quote("2026-11-02 10:00", 80) });
    expect(breached.after.state.status).toBe("FAILED");
    expect(breached.delta.fills).toMatchObject([{ reason: "BREACH", side: "SELL", quantity: 75 }]);
    expect(breached.delta.events).toMatchObject([{ key: "breach", kind: "BREACH", detail: { rules: ["DAILY_LOSS"] } }]);

    // Nothing new, nothing recorded: a retried write adds no rows.
    expect(auditIsEmpty(auditDelta(breached.after, breached.after))).toBe(true);
  });

  it("records a pass once, with the profit and trading days", () => {
    const before = openDesk(plan, owner.id, ist("2026-11-02 09:00"));
    const after: Desk = { ...before, state: { ...before.state, status: "PASSED", passedOn: "2026-11-06", balance: r(1_06_500), days: [{ date: "2026-11-05", net: r(3_000) }, { date: "2026-11-06", net: r(3_500) }], clock: ist("2026-11-06 15:30") } };
    expect(auditDelta(before, after).events).toEqual([{ key: "passed", kind: "PASSED", orderId: null, at: ist("2026-11-06 15:30"), detail: { date: "2026-11-06", balance: r(1_06_500), profit: r(6_500), tradingDays: 2 } }]);
    expect(auditDelta(after, after).events).toEqual([]);
  });

  it("files a fill under its IST trading date, and keeps the charges breakdown", () => {
    const fill: Fill = { id: `${owner.id}:F1`, orderId: null, reason: "SQUARE_OFF", token: CALL.token, tradingSymbol: CALL.tradingSymbol, side: "SELL", quantity: 75, price: r(110), at: ist("2026-11-03 02:00"), realised: r(-750), charges: { brokerage: 2_000, stt: 500, transaction: 300, sebi: 1, stamp: 0, gst: 414, total: 3_215 }, chargesSchedule: "test", balanceAfter: r(99_000) };
    const row = fillRow(owner, fill);
    expect(row).toMatchObject({ accountId: owner.id, userId: owner.userId, fillId: fill.id, orderId: null, reason: "SQUARE_OFF", chargesTotal: 3_215, charges: fill.charges, at: new Date(fill.at) });
    // 02:00 IST on the 3rd is the evening of the 2nd in UTC: the trading date is still the 3rd.
    expect((row.tradeDate as Date).toISOString().slice(0, 10)).toBe("2026-11-03");
  });

  it("records an order the trading policy refused, keyed by its order id", () => {
    const event = refusalEvent({ id: "R1", token: CALL.token, tradingSymbol: CALL.tradingSymbol, side: "BUY", lots: 1, type: "MARKET" }, "No hedging across accounts.", ist("2026-11-02 11:00"));
    expect(eventRow(owner, event)).toEqual({ accountId: owner.id, userId: owner.userId, key: "refused:R1", kind: "ORDER_REFUSED", orderId: "R1", at: new Date(ist("2026-11-02 11:00")), detail: { tradingSymbol: CALL.tradingSymbol, token: CALL.token, side: "BUY", type: "MARKET", lots: 1, reason: "No hedging across accounts." } });
  });
});
