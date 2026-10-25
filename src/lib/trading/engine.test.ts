import { describe, expect, it } from "vitest";
import { findAccountPlan } from "../prop-firm";
import { chargesForFill, type ChargesSchedule } from "./charges";
import { CHARGES_SCHEDULES } from "./charges-schedules";
import {
  openAccount, positionsView, replay, riskMeters, step,
  type AccountPhase, type AccountState, type EngineContext, type EngineEvent, type EngineOutput, type Fill, type OrderRequest,
} from "./engine";
import type { Instrument, Side } from "./instruments";
import type { Quote } from "./matching";
import { quotePayout, type PayoutChecks } from "./payouts";
import { ruleSetFor } from "./rules";
import { ist, isWeekday } from "./time";

// Test fixtures, not exchange values: real lot, tick and freeze sizes come from the contract master.
const FUT: Instrument = { token: 101, exchange: "NFO", tradingSymbol: "NIFTY-FUT-TEST", underlying: "NIFTY", kind: "FUT", expiry: "2026-11-24", strike: null, lotSize: 50, tickSize: 10, freezeQuantity: 900 };
const CE1: Instrument = { token: 201, exchange: "NFO", tradingSymbol: "NIFTY-25000-CE-TEST", underlying: "NIFTY", kind: "CE", expiry: "2026-11-03", strike: 25_000_00, lotSize: 50, tickSize: 5, freezeQuantity: 900 };
const CE2: Instrument = { ...CE1, token: 202, tradingSymbol: "NIFTY-25100-CE-TEST", strike: 25_100_00 };
const PE1: Instrument = { ...CE1, token: 203, tradingSymbol: "NIFTY-24900-PE-TEST", kind: "PE", strike: 24_900_00 };
const SENSEX_CE: Instrument = { token: 301, exchange: "BFO", tradingSymbol: "SENSEX-82000-CE-TEST", underlying: "SENSEX", kind: "CE", expiry: "2026-11-05", strike: 82_000_00, lotSize: 20, tickSize: 5, freezeQuantity: 500 };
const INSTRUMENTS = [FUT, CE1, CE2, PE1, SENSEX_CE];

const NO_COST: ChargesSchedule = {
  id: "test-no-cost",
  effectiveFrom: "2026-01-01",
  source: "test",
  verified: false,
  futures: { brokerage: { kind: "flat", perOrder: 0 }, sttSell: 0, stampBuy: 0, transaction: { NFO: 0, BFO: 0 } },
  options: { brokerage: { kind: "flat", perOrder: 0 }, sttSell: 0, stampBuy: 0, transaction: { NFO: 0, BFO: 0 } },
  sebi: 0,
  gst: 0,
};

const r = (rupees: number) => Math.round(rupees * 100);

type Book = { bids?: [number, number][]; asks?: [number, number][] };
type PlaceInput = { token: number; side: Side; id?: string; lots?: number; type?: OrderRequest["type"]; limit?: number; trigger?: number };

/** Drives one account the way the engine service will: quotes update the shared book first. */
class Sim {
  state: AccountState;
  readonly initial: AccountState;
  readonly events: EngineEvent[] = [];
  readonly outputs: EngineOutput[] = [];
  readonly context: EngineContext;
  private readonly quotes = new Map<number, Quote>();
  private orders = 0;

  constructor(options: { plan?: string; phase?: AccountPhase; charges?: readonly ChargesSchedule[]; slippageTicks?: number } = {}) {
    this.state = openAccount({ id: "A1", phase: options.phase ?? "EVALUATION", rules: ruleSetFor(findAccountPlan(options.plan ?? "1l")!), at: ist("2026-11-02 08:00") });
    this.initial = this.state;
    const instruments = new Map(INSTRUMENTS.map((instrument) => [instrument.token, instrument]));
    this.context = {
      instrument: (token) => instruments.get(token),
      quote: (token) => this.quotes.get(token),
      isTradingDay: isWeekday,
      charges: options.charges ?? [NO_COST],
      slippageTicks: options.slippageTicks ?? 0,
      staleAfterMs: 5_000,
    };
  }

  send(event: EngineEvent): EngineOutput[] {
    if (event.kind === "quote") this.quotes.set(event.quote.token, event.quote);
    const result = step(this.state, event, this.context);
    this.state = result.state;
    this.events.push(event);
    this.outputs.push(...result.outputs);
    return result.outputs;
  }

  quote(time: string, instrument: Instrument, last: number, book: Book = {}) {
    const at = ist(time);
    const side = (levels: [number, number][] | undefined) => (levels ?? [[last, 10_000]]).map(([price, quantity]) => ({ price: r(price), quantity }));
    return this.send({ kind: "quote", at, quote: { token: instrument.token, at, lastPrice: r(last), bids: side(book.bids), asks: side(book.asks) } });
  }

  place(time: string, input: PlaceInput) {
    const order: OrderRequest = {
      id: input.id ?? `O${++this.orders}`,
      token: input.token,
      side: input.side,
      lots: input.lots ?? 1,
      type: input.type ?? "MARKET",
      ...(input.limit !== undefined ? { limitPrice: r(input.limit) } : {}),
      ...(input.trigger !== undefined ? { triggerPrice: r(input.trigger) } : {}),
    };
    return this.send({ kind: "place", at: ist(time), order });
  }

  clock(time: string) {
    return this.send({ kind: "clock", at: ist(time) });
  }

  /** Buy one lot at `buy` and sell it at `sell` on one day, then close the day. */
  roundTrip(date: string, instrument: Instrument, buy: number, sell: number) {
    this.quote(`${date} 09:20`, instrument, buy);
    this.place(`${date} 09:20`, { token: instrument.token, side: "BUY" });
    this.quote(`${date} 10:00`, instrument, sell);
    this.place(`${date} 10:00`, { token: instrument.token, side: "SELL" });
    return this.clock(`${date} 15:31`);
  }
}

const kinds = (outputs: EngineOutput[]) => outputs.map((output) => output.kind);
const fills = (outputs: EngineOutput[]): Fill[] => outputs.flatMap((output) => (output.kind === "fill" ? [output.fill] : []));
const rejection = (outputs: EngineOutput[]) => outputs.find((output) => output.kind === "rejected");
const reasonOf = (outputs: EngineOutput[]) => {
  const rejected = rejection(outputs);
  return rejected?.kind === "rejected" ? rejected.reason : null;
};
const START = r(1_00_000);

describe("simulated orders", () => {
  it("fills a market order at the ask plus slippage and marks it at the last price", () => {
    const sim = new Sim({ slippageTicks: 1 });
    sim.quote("2026-11-02 09:20", CE1, 100, { bids: [[99.95, 500]], asks: [[100.05, 500]] });
    const out = sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" });
    expect(kinds(out)).toEqual(["accepted", "fill"]);
    expect(fills(out)[0]).toMatchObject({ price: r(100.1), quantity: 50, side: "BUY", reason: "ORDER", realised: 0 });
    expect(sim.state.balance).toBe(START);
    expect(riskMeters(sim.state).unrealised).toBe((r(100) - r(100.1)) * 50);
  });

  it("walks the depth and keeps the unfilled part of a market order working", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 100, { asks: [[100, 30], [100.5, 10]] });
    const out = sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" });
    expect(fills(out).map((fill) => [fill.price, fill.quantity])).toEqual([[r(100), 30], [r(100.5), 10]]);
    expect(sim.state.orders).toHaveLength(1);
    const next = sim.quote("2026-11-02 09:21", CE1, 101, { asks: [[101, 100]] });
    expect(fills(next).map((fill) => [fill.price, fill.quantity])).toEqual([[r(101), 10]]);
    expect(sim.state.orders).toHaveLength(0);
    expect(positionsView(sim.state)[0]).toMatchObject({ quantity: 50, lots: 1, averagePrice: r(100.3) });
  });

  it("rests a limit order and fills it at its price when the market comes to it", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 101, { bids: [[100.95, 100]], asks: [[101, 100]] });
    expect(kinds(sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY", type: "LIMIT", limit: 100 }))).toEqual(["accepted"]);
    const out = sim.quote("2026-11-02 09:25", CE1, 99.5, { asks: [[99.5, 100]] });
    expect(fills(out).map((fill) => [fill.price, fill.quantity])).toEqual([[r(100), 50]]);
  });

  it("fills a marketable limit at book prices up to the limit and rests the rest", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 99.5, { asks: [[99.5, 20], [100, 20], [100.5, 100]] });
    const out = sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY", type: "LIMIT", limit: 100 });
    expect(fills(out).map((fill) => [fill.price, fill.quantity])).toEqual([[r(99.5), 20], [r(100), 20]]);
    expect(sim.state.orders[0]).toMatchObject({ filled: 40, resting: true });
    const next = sim.quote("2026-11-02 09:21", CE1, 99, { asks: [[99, 100]] });
    expect(fills(next).map((fill) => [fill.price, fill.quantity])).toEqual([[r(100), 10]]);
  });

  it("triggers a stop-loss on the last price and exits at market", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 100);
    sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" });
    expect(kinds(sim.place("2026-11-02 09:20", { token: CE1.token, side: "SELL", type: "SL-M", trigger: 95 }))).toEqual(["accepted"]);
    expect(fills(sim.quote("2026-11-02 09:21", CE1, 96))).toEqual([]);
    const out = sim.quote("2026-11-02 09:22", CE1, 95, { bids: [[94.95, 500]] });
    expect(kinds(out)).toEqual(["triggered", "fill"]);
    expect(fills(out)[0]).toMatchObject({ price: r(94.95), realised: (r(94.95) - r(100)) * 50 });
    expect(sim.state.balance).toBe(START + (r(94.95) - r(100)) * 50);
  });

  it("cancels a working order on request", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 101);
    sim.place("2026-11-02 09:20", { id: "L1", token: CE1.token, side: "BUY", type: "LIMIT", limit: 100 });
    expect(sim.send({ kind: "cancel", at: ist("2026-11-02 09:21"), orderId: "L1" })).toEqual([{ kind: "cancelled", at: ist("2026-11-02 09:21"), orderId: "L1", reason: "TRADER", filled: 0 }]);
    expect(reasonOf(sim.send({ kind: "cancel", at: ist("2026-11-02 09:22"), orderId: "L1" }))).toBe("UNKNOWN_ORDER");
  });
});

describe("modifying orders", () => {
  const modify = (sim: Sim, time: string, orderId: string, changes: { lots?: number; limit?: number; trigger?: number }) =>
    sim.send({
      kind: "modify",
      at: ist(time),
      orderId,
      changes: {
        ...(changes.lots !== undefined ? { lots: changes.lots } : {}),
        ...(changes.limit !== undefined ? { limitPrice: r(changes.limit) } : {}),
        ...(changes.trigger !== undefined ? { triggerPrice: r(changes.trigger) } : {}),
      },
    });

  it("moves a resting limit order and fills it once the new price meets the book", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 101, { bids: [[100.95, 100]], asks: [[101, 100]] });
    sim.place("2026-11-02 09:20", { id: "L1", token: CE1.token, side: "BUY", type: "LIMIT", limit: 100 });
    expect(kinds(modify(sim, "2026-11-02 09:20", "L1", { limit: 100.5 }))).toEqual(["modified"]);
    expect(sim.state.orders[0]).toMatchObject({ limitPrice: r(100.5), lots: 1, quantity: 50 });
    const out = modify(sim, "2026-11-02 09:20", "L1", { limit: 101 });
    expect(kinds(out)).toEqual(["modified", "fill"]);
    expect(fills(out)[0]).toMatchObject({ orderId: "L1", price: r(101), quantity: 50 });
    expect(sim.state.orders).toEqual([]);
  });

  it("changes the size around what has filled, but not below it", () => {
    const sim = new Sim({ plan: "10l" });
    sim.quote("2026-11-02 09:20", CE1, 100, { asks: [[100, 60]] });
    sim.place("2026-11-02 09:20", { id: "L1", token: CE1.token, side: "BUY", type: "LIMIT", limit: 100, lots: 2 });
    expect(sim.state.orders[0]).toMatchObject({ quantity: 100, filled: 60 });
    expect(reasonOf(modify(sim, "2026-11-02 09:20", "L1", { lots: 1 }))).toBe("BELOW_FILLED");
    expect(kinds(modify(sim, "2026-11-02 09:20", "L1", { lots: 3 }))).toEqual(["modified"]);
    expect(sim.state.orders[0]).toMatchObject({ lots: 3, quantity: 150, filled: 60 });
  });

  it("checks new terms like a new order", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 100);
    sim.place("2026-11-02 09:20", { id: "L1", token: CE1.token, side: "BUY", type: "LIMIT", limit: 99 });
    expect(reasonOf(modify(sim, "2026-11-02 09:20", "L1", { limit: 99.03 }))).toBe("INVALID_PRICE");
    expect(reasonOf(modify(sim, "2026-11-02 09:20", "L1", { lots: 2 }))).toBe("LOT_LIMIT");
    expect(reasonOf(modify(sim, "2026-11-02 09:20", "nope", { limit: 98 }))).toBe("UNKNOWN_ORDER");
    sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" });
    sim.place("2026-11-02 09:20", { id: "S1", token: CE1.token, side: "SELL", type: "SL-M", trigger: 95 });
    expect(reasonOf(modify(sim, "2026-11-02 09:20", "S1", { trigger: 101 }))).toBe("TRIGGER_ALREADY_CROSSED");
    expect(kinds(modify(sim, "2026-11-02 09:20", "S1", { trigger: 97 }))).toEqual(["modified"]);
    expect(sim.state.orders.find((order) => order.id === "S1")).toMatchObject({ triggerPrice: r(97), triggered: false });
    expect(reasonOf(modify(sim, "2026-11-02 09:20:06", "S1", { trigger: 96 }))).toBe("STALE_QUOTE");
  });

  it("refuses changes once the 15:20 square-off has cancelled the order", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 101);
    sim.place("2026-11-02 09:20", { id: "L1", token: CE1.token, side: "BUY", type: "LIMIT", limit: 100 });
    sim.clock("2026-11-02 15:20");
    expect(reasonOf(modify(sim, "2026-11-02 15:21", "L1", { limit: 100.5 }))).toBe("UNKNOWN_ORDER");
  });
});

describe("order checks", () => {
  it("accepts orders only from 09:15 to 15:20 IST on trading days", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:14", CE1, 100);
    expect(reasonOf(sim.place("2026-11-02 09:14:59", { token: CE1.token, side: "BUY" }))).toBe("MARKET_CLOSED");
    sim.quote("2026-11-02 15:19:59", CE1, 100);
    expect(kinds(sim.place("2026-11-02 15:19:59", { token: CE1.token, side: "BUY" }))).toEqual(["accepted", "fill"]);
    sim.quote("2026-11-02 15:20", CE1, 100);
    expect(reasonOf(sim.place("2026-11-02 15:20", { token: CE1.token, side: "BUY" }))).toBe("MARKET_CLOSED");
    sim.quote("2026-11-07 10:00", CE1, 100); // Saturday
    expect(reasonOf(sim.place("2026-11-07 10:00", { token: CE1.token, side: "BUY" }))).toBe("MARKET_CLOSED");
  });

  it("rejects bad contracts, sizes and prices", () => {
    const sim = new Sim({ plan: "10l" });
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" }))).toBe("NO_QUOTE");
    sim.quote("2026-11-02 09:20", CE1, 100);
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: 999, side: "BUY" }))).toBe("UNKNOWN_INSTRUMENT");
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY", lots: 0 }))).toBe("INVALID_QUANTITY");
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY", lots: 1.5 }))).toBe("INVALID_QUANTITY");
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY", lots: 19 }))).toBe("FREEZE_QUANTITY");
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY", type: "LIMIT", limit: 100.03 }))).toBe("INVALID_PRICE");
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY", type: "SL", trigger: 101, limit: 100.5 }))).toBe("INVALID_PRICE");
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY", type: "SL-M", trigger: 99 }))).toBe("TRIGGER_ALREADY_CROSSED");
    expect(reasonOf(sim.send({ kind: "place", at: ist("2026-11-02 09:20"), order: { id: "X", token: CE1.token, side: "BUY", lots: 1, type: "STOP" as OrderRequest["type"] } }))).toBe("INVALID_ORDER");
    expect(reasonOf(sim.place("2026-11-02 09:20:06", { token: CE1.token, side: "BUY" }))).toBe("STALE_QUOTE");
  });

  it("treats a repeated client order id as a duplicate", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 101);
    sim.place("2026-11-02 09:20", { id: "same", token: CE1.token, side: "BUY", type: "LIMIT", limit: 100 });
    expect(reasonOf(sim.place("2026-11-02 09:20", { id: "same", token: CE1.token, side: "BUY", type: "LIMIT", limit: 100 }))).toBe("DUPLICATE_ORDER_ID");
    expect(sim.state.orders).toHaveLength(1);
  });

  it("enforces the plan's lot limit", () => {
    const small = new Sim({ plan: "1l" });
    small.quote("2026-11-02 09:20", FUT, 25_000);
    small.quote("2026-11-02 09:20", CE1, 100);
    expect(reasonOf(small.place("2026-11-02 09:20", { token: FUT.token, side: "BUY", lots: 2 }))).toBe("LOT_LIMIT");
    expect(kinds(small.place("2026-11-02 09:20", { token: FUT.token, side: "BUY" }))).toEqual(["accepted", "fill"]);
    expect(reasonOf(small.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" }))).toBe("LOT_LIMIT");

    const larger = new Sim({ plan: "2-5l" });
    larger.quote("2026-11-02 09:20", FUT, 25_000);
    expect(kinds(larger.place("2026-11-02 09:20", { token: FUT.token, side: "SELL", lots: 2 }))).toEqual(["accepted", "fill"]);
    expect(riskMeters(larger.state).lotsInUse).toBe(2);
  });

  it("allows short options only as covered spread legs", () => {
    const sim = new Sim();
    for (const instrument of [CE1, CE2, PE1]) sim.quote("2026-11-02 09:20", instrument, 100);
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: CE2.token, side: "SELL" }))).toBe("NAKED_SHORT");
    sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" });
    expect(kinds(sim.place("2026-11-02 09:20", { token: CE2.token, side: "SELL" }))).toEqual(["accepted", "fill"]);
    expect(riskMeters(sim.state).lotsInUse).toBe(1);
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: PE1.token, side: "SELL" }))).toBe("NAKED_SHORT");
    expect(reasonOf(sim.place("2026-11-02 09:20", { token: CE1.token, side: "SELL" }))).toBe("NAKED_SHORT");
    expect(kinds(sim.place("2026-11-02 09:20", { token: CE2.token, side: "BUY" }))).toEqual(["accepted", "fill"]);
    expect(kinds(sim.place("2026-11-02 09:20", { token: CE1.token, side: "SELL" }))).toEqual(["accepted", "fill"]);
    expect(sim.state.positions).toEqual([]);
  });

  it("blocks new positions in expiring contracts in the last hour of expiry day but allows exits", () => {
    const sim = new Sim({ plan: "2-5l" });
    sim.quote("2026-11-03 14:29:59", CE1, 100);
    expect(kinds(sim.place("2026-11-03 14:29:59", { token: CE1.token, side: "BUY" }))).toEqual(["accepted", "fill"]);
    sim.quote("2026-11-03 14:30", CE1, 100);
    expect(reasonOf(sim.place("2026-11-03 14:30", { token: CE1.token, side: "BUY" }))).toBe("EXPIRY_WINDOW");
    sim.quote("2026-11-03 14:45", CE1, 100);
    sim.quote("2026-11-03 14:45", FUT, 25_000);
    expect(kinds(sim.place("2026-11-03 14:45", { token: CE1.token, side: "SELL" }))).toEqual(["accepted", "fill"]);
    expect(kinds(sim.place("2026-11-03 14:45", { token: FUT.token, side: "BUY" }))).toEqual(["accepted", "fill"]);
  });
});

describe("intraday session", () => {
  it("cancels working orders and squares off open positions at 15:20", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 10:00", FUT, 25_000);
    sim.place("2026-11-02 10:00", { token: FUT.token, side: "BUY" });
    sim.place("2026-11-02 10:00", { id: "TP", token: FUT.token, side: "SELL", type: "LIMIT", limit: 25_100 });
    const out = sim.clock("2026-11-02 15:20");
    expect(kinds(out)).toEqual(["cancelled", "fill"]);
    expect(out[0]).toMatchObject({ orderId: "TP", reason: "SQUARE_OFF" });
    expect(fills(out)[0]).toMatchObject({ reason: "SQUARE_OFF", side: "SELL", quantity: 50, price: r(25_000), orderId: null });
    expect(sim.state.positions).toEqual([]);
    expect(reasonOf(sim.place("2026-11-02 15:21", { token: FUT.token, side: "BUY" }))).toBe("MARKET_CLOSED");
    expect(sim.clock("2026-11-02 15:30")).toEqual([
      { kind: "day-closed", at: ist("2026-11-02 15:30"), date: "2026-11-02", net: 0, balance: START, maxLossFloor: r(96_000), tradingDays: 1 },
    ]);
  });

  it("squares off at that day's 15:20 at the last price if clock ticks were missed", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 10:00", FUT, 25_000);
    sim.place("2026-11-02 10:00", { token: FUT.token, side: "BUY" });
    sim.quote("2026-11-02 15:10", FUT, 25_010);
    const out = sim.clock("2026-11-03 09:00");
    expect(fills(out)[0]).toMatchObject({ reason: "SQUARE_OFF", price: r(25_010), at: ist("2026-11-02 15:20") });
    expect(out.find((output) => output.kind === "day-closed")).toMatchObject({ date: "2026-11-02", net: r(10) * 50 });
    expect(sim.state.day?.date).toBe("2026-11-03");
  });

  it("refuses events out of time order", () => {
    const sim = new Sim();
    sim.clock("2026-11-02 10:00");
    expect(() => sim.clock("2026-11-02 09:59")).toThrow(/time order/);
  });
});

describe("loss limits", () => {
  it("fails the account when open loss touches the daily loss limit, with a breach report", () => {
    const sim = new Sim();
    sim.quote("2026-11-02 09:20", CE1, 100);
    sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" });
    expect(kinds(sim.quote("2026-11-02 09:30", CE1, 60.05))).toEqual([]);
    const out = sim.quote("2026-11-02 09:31", CE1, 60);
    expect(kinds(out)).toEqual(["breach", "fill"]);
    const breach = out[0].kind === "breach" ? out[0].report : null;
    expect(breach).toMatchObject({
      rules: ["DAILY_LOSS"],
      date: "2026-11-02",
      ruleVersion: "India v1",
      equity: START - r(2_000),
      dayOpeningBalance: START,
      dailyLossLimit: r(2_000),
      maxLossFloor: r(96_000),
      trigger: { kind: "quote", token: CE1.token, tradingSymbol: CE1.tradingSymbol, lastPrice: r(60) },
      positions: [{ tradingSymbol: CE1.tradingSymbol, quantity: 50, averagePrice: r(100), mark: r(60), unrealised: -r(2_000) }],
    });
    expect(fills(out)[0]).toMatchObject({ reason: "BREACH", side: "SELL", price: r(60) });
    expect(sim.state.status).toBe("FAILED");
    expect(reasonOf(sim.place("2026-11-02 09:32", { token: CE1.token, side: "BUY" }))).toBe("ACCOUNT_LOCKED");
    expect(kinds(sim.clock("2026-11-02 15:31"))).toEqual(["day-closed"]);
    expect(sim.clock("2026-11-03 10:00")).toEqual([]);
  });

  it("trails the max drawdown on end-of-day balances and fails at the floor", () => {
    const sim = new Sim();
    const floorAfter = (outputs: EngineOutput[]) => outputs.find((output) => output.kind === "day-closed");
    expect(floorAfter(sim.roundTrip("2026-11-02", FUT, 25_000, 25_060))).toMatchObject({ net: r(3_000), maxLossFloor: r(99_000) });
    expect(floorAfter(sim.roundTrip("2026-11-03", FUT, 25_000, 24_970))).toMatchObject({ net: -r(1_500), maxLossFloor: r(99_000) });
    expect(floorAfter(sim.roundTrip("2026-11-04", FUT, 25_000, 24_970))).toMatchObject({ balance: START, maxLossFloor: r(99_000) });
    sim.quote("2026-11-05 09:20", FUT, 25_000);
    sim.place("2026-11-05 09:20", { token: FUT.token, side: "BUY" });
    expect(kinds(sim.quote("2026-11-05 09:40", FUT, 24_980.1))).toEqual([]);
    const out = sim.quote("2026-11-05 09:41", FUT, 24_980);
    expect(out[0]).toMatchObject({ kind: "breach", report: { rules: ["MAX_LOSS"], equity: r(99_000), maxLossFloor: r(99_000) } });
    expect(riskMeters(sim.state)).toMatchObject({ status: "FAILED", balance: r(99_000), dailyLossUsed: r(1_000) });
  });

  it("locks the floor at the starting balance", () => {
    const sim = new Sim();
    const out = sim.roundTrip("2026-11-02", FUT, 25_000, 25_100);
    expect(out.find((output) => output.kind === "day-closed")).toMatchObject({ balance: r(1_05_000), maxLossFloor: START });
  });

  it("never breaches on stale prices", () => {
    const sim = new Sim({ plan: "2-5l" }); // ₹5,000 daily loss
    sim.quote("2026-11-02 09:20", CE1, 100);
    sim.quote("2026-11-02 09:20", FUT, 25_000);
    sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" });
    sim.place("2026-11-02 09:20", { token: FUT.token, side: "BUY" });
    sim.quote("2026-11-02 09:21", CE1, 50); // -₹2,500, then no CE ticks for a while
    expect(kinds(sim.quote("2026-11-02 09:40", FUT, 24_950))).toEqual([]); // another -₹2,500, but the CE price is stale
    expect(sim.state.status).toBe("ACTIVE");
    const out = sim.quote("2026-11-02 09:40:01", CE1, 50);
    expect(out[0]).toMatchObject({ kind: "breach", report: { rules: ["DAILY_LOSS"], equity: r(2_50_000) - r(5_000) } });
  });
});

describe("passing", () => {
  it("passes at the close of the day the target, minimum days and consistency are all met", () => {
    const sim = new Sim();
    const dates = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];
    for (const date of dates) expect(kinds(sim.roundTrip(date, FUT, 25_000, 25_026))).not.toContain("passed");
    const out = sim.roundTrip("2026-11-06", FUT, 25_000, 25_026);
    expect(out.find((output) => output.kind === "passed")).toMatchObject({ date: "2026-11-06", profit: r(6_500), tradingDays: 5 });
    expect(sim.state).toMatchObject({ status: "PASSED", passedOn: "2026-11-06" });
    sim.quote("2026-11-09 09:20", FUT, 25_000);
    expect(reasonOf(sim.place("2026-11-09 09:20", { token: FUT.token, side: "BUY" }))).toBe("ACCOUNT_LOCKED");
  });

  it("keeps trading until the best day is at most half of total profit", () => {
    const sim = new Sim();
    sim.roundTrip("2026-11-02", FUT, 25_000, 25_100); // +₹5,000
    for (const date of ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]) sim.roundTrip(date, FUT, 25_000, 25_006); // +₹300
    expect(sim.state.status).toBe("ACTIVE");
    expect(riskMeters(sim.state)).toMatchObject({ profit: r(6_200), bestDay: r(5_000), bestDayAllowed: r(3_100), consistencyMet: false });
    for (const date of ["2026-11-09", "2026-11-10", "2026-11-11"]) expect(kinds(sim.roundTrip(date, FUT, 25_000, 25_020))).not.toContain("passed"); // +₹1,000
    const out = sim.roundTrip("2026-11-12", FUT, 25_000, 25_020);
    expect(out.find((output) => output.kind === "passed")).toMatchObject({ profit: r(10_200), tradingDays: 9 });
  });
});

describe("charges in the account", () => {
  it("takes every charge off the balance and bills brokerage once per order", () => {
    const sim = new Sim({ charges: CHARGES_SCHEDULES });
    sim.quote("2026-11-02 09:20", CE1, 120.5, { asks: [[120.5, 20], [121, 100]] });
    const buys = fills(sim.place("2026-11-02 09:20", { token: CE1.token, side: "BUY" }));
    expect(buys.map((fill) => fill.charges.brokerage)).toEqual([2_000, 0]);
    expect(buys[0].chargesSchedule).toBe("in-fo-2026-04");
    sim.quote("2026-11-02 10:00", CE1, 130);
    const [sell] = fills(sim.place("2026-11-02 10:00", { token: CE1.token, side: "SELL" }));
    expect(sell.charges).toEqual(chargesForFill({ kind: "CE", exchange: "NFO", side: "SELL", turnover: r(130) * 50, orderTurnoverBefore: 0, brokerageChargedBefore: 0 }, CHARGES_SCHEDULES[0]));
    const gross = r(130) * 50 - (r(120.5) * 20 + r(121) * 30);
    const charges = [...buys, sell].reduce((sum, fill) => sum + fill.charges.total, 0);
    expect(sell.realised).toBe(gross);
    expect(sim.state.balance).toBe(START + gross - charges);
  });

  it("bills SENSEX contracts at BSE rates", () => {
    const sim = new Sim({ charges: CHARGES_SCHEDULES });
    sim.quote("2026-11-02 09:20", SENSEX_CE, 200);
    const [fill] = fills(sim.place("2026-11-02 09:20", { token: SENSEX_CE.token, side: "BUY" }));
    expect(fill.charges.transaction).toBe(Math.round((r(200) * 20 * 32_500) / 1e8));
  });
});

describe("replay", () => {
  function scenario() {
    const sim = new Sim({ charges: CHARGES_SCHEDULES, slippageTicks: 1 });
    sim.roundTrip("2026-11-02", FUT, 25_000, 25_060);
    sim.roundTrip("2026-11-03", CE1, 100, 92.5);
    sim.quote("2026-11-04 09:20", SENSEX_CE, 200, { asks: [[200, 10], [200.5, 100]] });
    sim.place("2026-11-04 09:20", { token: SENSEX_CE.token, side: "BUY" });
    sim.place("2026-11-04 09:20", { token: SENSEX_CE.token, side: "SELL", type: "SL-M", trigger: 140 });
    sim.quote("2026-11-04 09:45", SENSEX_CE, 139, { bids: [[138.95, 100]] });
    sim.quote("2026-11-04 09:50", FUT, 25_000);
    sim.place("2026-11-04 09:50", { token: FUT.token, side: "SELL" });
    sim.quote("2026-11-04 10:30", FUT, 25_080);
    sim.clock("2026-11-04 15:31");
    return sim;
  }
  const setup = { instruments: INSTRUMENTS, isTradingDay: isWeekday, charges: CHARGES_SCHEDULES, slippageTicks: 1, staleAfterMs: 5_000 };

  it("reproduces every output and the final state from the recorded events", () => {
    const sim = scenario();
    expect(sim.outputs.some((output) => output.kind === "breach")).toBe(true);
    const again = replay(sim.initial, sim.events, setup);
    expect(again.outputs).toEqual(sim.outputs);
    expect(again.state).toEqual(sim.state);
  });

  it("continues identically from a stored JSON snapshot", () => {
    const sim = scenario();
    const half = Math.floor(sim.events.length / 2);
    const first = replay(sim.initial, sim.events.slice(0, half), setup);
    const stored = JSON.parse(JSON.stringify(first.state)) as AccountState;
    // The host keeps the market's latest quotes; a resumed account starts with them.
    const latest = new Map<number, Quote>();
    for (const event of sim.events.slice(0, half)) if (event.kind === "quote") latest.set(event.quote.token, event.quote);
    const resumed = replay(stored, sim.events.slice(half), { ...setup, quotes: [...latest.values()] });
    expect([...first.outputs, ...resumed.outputs]).toEqual(sim.outputs);
    expect(resumed.state).toEqual(sim.state);
  });
});

describe("funded payouts", () => {
  const allClear: PayoutChecks = { kycVerified: true, agreementSigned: true, bankVerified: true, onHold: false };

  function fundedWithProfit() {
    const sim = new Sim({ phase: "FUNDED" });
    sim.roundTrip("2026-11-02", FUT, 25_000, 25_120); // +₹6,000
    sim.roundTrip("2026-11-03", FUT, 25_000, 25_120); // +₹6,000
    return sim;
  }

  it("pays the split of profit above the buffer, up to the cap", () => {
    const sim = fundedWithProfit();
    expect(sim.state.status).toBe("ACTIVE");
    const quote = quotePayout(sim.state, allClear);
    expect(quote).toEqual({
      eligible: true,
      blocks: [],
      profit: r(12_000),
      buffer: r(4_000),
      withdrawableProfit: r(8_000),
      traderShare: r(6_400),
      payout: r(5_000),
      debit: r(6_250),
    });
    sim.send({ kind: "payout", at: ist("2026-11-04 16:00"), debit: quote.debit });
    expect(sim.state.balance).toBe(r(1_05_750));

    expect(quotePayout(sim.state, allClear, r(1_000))).toMatchObject({ payout: r(1_000), debit: r(1_250) });
  });

  it("allows another payout the same day while eligible profit remains", () => {
    const sim = fundedWithProfit();
    const first = quotePayout(sim.state, allClear);
    sim.send({ kind: "payout", at: ist("2026-11-04 16:00"), debit: first.debit });
    const next = quotePayout(sim.state, allClear);
    expect(next).toMatchObject({ eligible: true, blocks: [], withdrawableProfit: r(1_750), payout: r(1_400), debit: r(1_750) });
    sim.send({ kind: "payout", at: ist("2026-11-04 16:01"), debit: next.debit });
    expect(sim.state.balance).toBe(r(1_04_000));
    expect(quotePayout(sim.state, allClear)).toMatchObject({ eligible: false, blocks: ["NO_PROFIT_ABOVE_BUFFER"], payout: 0 });
  });

  it("lists every block and refuses debits beyond the buffer", () => {
    const sim = fundedWithProfit();
    const blocked = quotePayout(sim.state, { kycVerified: false, agreementSigned: false, bankVerified: false, onHold: true });
    expect(blocked.blocks).toEqual(["KYC", "AGREEMENT", "BANK", "ON_HOLD"]);
    expect(() => sim.send({ kind: "payout", at: ist("2026-11-04 16:00"), debit: r(8_000) + 1 })).toThrow(/above the buffer/);
    sim.quote("2026-11-04 09:20", FUT, 25_000);
    sim.place("2026-11-04 09:20", { token: FUT.token, side: "BUY" });
    expect(quotePayout(sim.state, allClear).blocks).toEqual(["OPEN_POSITIONS"]);
    expect(quotePayout(new Sim().state, allClear).blocks).toEqual(["NOT_FUNDED", "NO_PROFIT_ABOVE_BUFFER"]);
  });
});
