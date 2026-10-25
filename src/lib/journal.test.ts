import { describe, expect, it } from "vitest";
import { accountDays, journalTotals, mergeDays, monthWeeks, settledDesk, shiftMonth } from "./journal";
import { findEvaluationPlan } from "./prop-firm";
import { deskStep, openDesk, type Desk } from "./trading/desk";
import { riskMeters, type EngineEvent } from "./trading/engine";
import type { Instrument } from "./trading/instruments";
import type { Quote } from "./trading/matching";
import { ist } from "./trading/time";

// Test fixtures, not exchange values.
const r = (rupees: number) => Math.round(rupees * 100);
const CALL: Instrument = { token: 301, exchange: "NFO", tradingSymbol: "NIFTY-25000-CE-TEST", underlying: "NIFTY", kind: "CE", expiry: "2026-11-24", strike: r(25_000), lotSize: 75, tickSize: 5, freezeQuantity: 1_800 };
const quoteAt = (time: string, last: number): Quote => ({ token: CALL.token, at: ist(time), lastPrice: r(last), bids: [{ price: r(last) - 5, quantity: 5_000 }], asks: [{ price: r(last) + 5, quantity: 5_000 }] });

function apply(desk: Desk, quotes: Map<number, Quote>, event: EngineEvent): Desk {
  if (event.kind === "quote") quotes.set(event.quote.token, event.quote);
  return deskStep(desk, event, quotes, CALL).desk;
}

/** Monday: buy a call, sell it higher, close the day. Tuesday: buy one and hold it. */
function twoDays(): Desk {
  const quotes = new Map<number, Quote>();
  let desk = openDesk(findEvaluationPlan("1l")!, "journal-1", ist("2026-11-02 09:00"));
  desk = apply(desk, quotes, { kind: "quote", at: ist("2026-11-02 09:30"), quote: quoteAt("2026-11-02 09:30", 120) });
  desk = apply(desk, quotes, { kind: "place", at: ist("2026-11-02 09:30"), order: { id: "A1", token: CALL.token, side: "BUY", lots: 1, type: "MARKET" } });
  desk = apply(desk, quotes, { kind: "quote", at: ist("2026-11-02 10:15"), quote: quoteAt("2026-11-02 10:15", 140) });
  desk = apply(desk, quotes, { kind: "place", at: ist("2026-11-02 10:15"), order: { id: "A2", token: CALL.token, side: "SELL", lots: 1, type: "MARKET" } });
  desk = apply(desk, quotes, { kind: "clock", at: ist("2026-11-02 15:35") });
  desk = apply(desk, quotes, { kind: "quote", at: ist("2026-11-03 09:30"), quote: quoteAt("2026-11-03 09:30", 100) });
  desk = apply(desk, quotes, { kind: "place", at: ist("2026-11-03 09:30"), order: { id: "B1", token: CALL.token, side: "BUY", lots: 1, type: "MARKET" } });
  return apply(desk, quotes, { kind: "quote", at: ist("2026-11-03 10:00"), quote: quoteAt("2026-11-03 10:00", 110) });
}

describe("journal days", () => {
  it("lists closed days from the engine and today while it trades, with fills counted", () => {
    const desk = twoDays();
    const meters = riskMeters(desk.state);
    expect(accountDays(desk)).toEqual([
      { date: "2026-11-02", net: desk.state.days[0].net, trades: 2, open: false },
      { date: "2026-11-03", net: meters.todayNet + meters.unrealised, trades: 1, open: true },
    ]);
    expect(desk.state.days[0].net).toBe((r(139.90) - r(120.10)) * 75 - desk.fills.slice(1).reduce((sum, fill) => sum + fill.charges.total, 0));
  });

  it("settles a day nobody closed, as the next poll would", () => {
    const settled = settledDesk(twoDays(), ist("2026-11-04 09:00"));
    expect(accountDays(settled).map(({ date, trades, open }) => ({ date, trades, open }))).toEqual([
      { date: "2026-11-02", trades: 2, open: false },
      { date: "2026-11-03", trades: 2, open: false },
    ]);
    expect(settled.state.positions).toEqual([]);
  });

  it("sums accounts by date and totals the journal", () => {
    const one = [{ date: "2026-11-02", net: 500, trades: 2, open: false }, { date: "2026-11-03", net: -300, trades: null, open: false }];
    const two = [{ date: "2026-11-03", net: -200, trades: null, open: false }, { date: "2026-11-04", net: 900, trades: 4, open: true }];
    const merged = mergeDays([one, two]);
    expect(merged).toEqual([
      { date: "2026-11-02", net: 500, trades: 2, open: false },
      { date: "2026-11-03", net: -500, trades: null, open: false },
      { date: "2026-11-04", net: 900, trades: 4, open: true },
    ]);
    expect(journalTotals(merged)).toEqual({ net: 900, days: 3, winning: 2, losing: 1, trades: 6 });
    expect(journalTotals([])).toEqual({ net: 0, days: 0, winning: 0, losing: 0, trades: 0 });
  });
});

describe("calendar weeks", () => {
  it("lays a month out Monday to Friday with neighbouring days filled in", () => {
    const october = monthWeeks("2026-10");
    expect(october.map((week) => week[0].date)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(october[0].map((day) => day.inMonth)).toEqual([false, false, false, true, true]);
    expect(october[4].map((day) => day.date)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
  });

  it("starts on the next Monday when the 1st falls at a weekend", () => {
    const november = monthWeeks("2026-11");
    expect(november[0][0]).toEqual({ date: "2026-11-02", inMonth: true });
    expect(november.at(-1)!.map((day) => day.inMonth)).toEqual([true, false, false, false, false]);
  });

  it("moves between months across a year end", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(() => monthWeeks("2026-13")).toThrow(RangeError);
  });
});
