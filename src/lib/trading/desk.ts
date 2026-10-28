/**
 * In-memory host for one simulated account, the way the engine service will host many: it keeps
 * the contracts the account has ordered or held, applies events in time order against the host's
 * latest quotes, and keeps the order book and a short log of fills and activity. JSON-serialisable,
 * so the server stores it whole (EvaluationAccount.desk). Pure: callers pass every time and quote in.
 */
import type { EvaluationPlan } from "../prop-firm";
import { CHARGES_SCHEDULES } from "./charges-schedules";
import { netQuantity, openAccount, step, unrealisedPnl, type AccountPhase, type AccountState, type CancelReason, type EngineContext, type EngineEvent, type EngineOutput, type Fill, type OrderRequest, type OrderType, type WorkingOrder } from "./engine";
import type { Instrument, Side } from "./instruments";
import type { Quote } from "./matching";
import { divRound, formatPaise, type Paise } from "./money";
import { ruleSetFor } from "./rules";
import { isWeekday, toIst } from "./time";

/** One tick of slippage on market fills (as in the engine's realistic tests); TRD MD-3 staleness. */
export const DESK_SETTINGS = { slippageTicks: 1, staleAfterMs: 5_000 } as const;
const FILLS_KEPT = 200;
const NOTES_KEPT = 100;
const ORDERS_KEPT = 200;
/** Exit orders are named after the buy or the change that set them. */
const STOP_SUFFIX = "-SL";
const TARGET_SUFFIX = "-TP";

export interface DeskNote {
  at: number;
  tone: "good" | "bad" | "info";
  text: string;
}

export type OrderStatus = "OPEN" | "COMPLETE" | "CANCELLED" | "REJECTED";

/** One order as the order book shows it, from placement to its final state. */
export interface OrderRecord {
  id: string;
  token: number;
  tradingSymbol: string;
  side: Side;
  type: OrderType;
  lots: number;
  /** Units ordered and filled so far. */
  quantity: number;
  filled: number;
  limitPrice?: Paise;
  triggerPrice?: Paise;
  /** Volume-weighted fill price; null until the first fill. */
  averagePrice: Paise | null;
  placedAt: number;
  updatedAt: number;
  status: OrderStatus;
  /** Why it was rejected or cancelled. */
  reason?: string;
}

export interface Desk {
  version: 1;
  state: AccountState;
  /** Contracts with a position or a working order. */
  instruments: Instrument[];
  /** Newest first. */
  fills: Fill[];
  /** Newest first. */
  notes: DeskNote[];
  /** Every order placed, newest first. Desks stored before the order book existed have none. */
  orderBook?: OrderRecord[];
  /** Fills per IST trading date, for the journal. Desks stored before it existed start empty. */
  dayTrades?: Record<string, number>;
  /** Buys with a stop-loss and target to set once they fill, kept while they are working. */
  brackets?: Bracket[];
}

/** A stop-loss trigger and a target price for a buy, in paise; either can be left out. */
export interface Exits {
  stop?: Paise;
  target?: Paise;
}

/**
 * A buy's stop-loss and target. When the buy fills they become the position's exits (see
 * positionExits), in place of any it had. The record stays while the buy is still working, so an
 * exit that fills first cancels what is left of it.
 */
export interface Bracket extends Exits {
  entryId: string;
  token: number;
  /** WAITING for the buy's first lot; ACTIVE once its exits are set, while the rest of it works. */
  status: "WAITING" | "ACTIVE";
}

/** Which exit an order is, from its id: a position's stop-loss or its target. */
export function exitRole(orderId: string): "stop" | "target" | null {
  return orderId.endsWith(STOP_SUFFIX) ? "stop" : orderId.endsWith(TARGET_SUFFIX) ? "target" : null;
}

/**
 * An open position's exits: at most one stop-loss (a stop-loss market sell) and one target (a limit
 * sell), each for the whole position. They can be set with the buy or at any time after. One cancels
 * the other: when one fills, or the position is closed some other way, the rest is cancelled; when
 * the position grows or shrinks, they follow it.
 */
export function positionExits(desk: Desk, token: number): { stop?: WorkingOrder; target?: WorkingOrder } {
  const exits: { stop?: WorkingOrder; target?: WorkingOrder } = {};
  for (const order of desk.state.orders) {
    const role = order.token === token ? exitRole(order.id) : null;
    if (role) exits[role] ??= order;
  }
  return exits;
}

/** New exits for an open position, in paise: a price sets or moves one, null removes it, and one left out stays. */
export interface ExitChanges {
  stop?: Paise | null;
  target?: Paise | null;
}

/**
 * What's wrong with new exits for an open position, or null: the option must be held, a new stop-loss
 * goes below the last price (`lastPrice`) and a new target above it, on the tick, and the stop-loss
 * stays below the target.
 */
export function positionExitsProblem(desk: Desk, token: number, changes: ExitChanges, lastPrice: Paise | undefined): string | null {
  const instrument = desk.instruments.find((item) => item.token === token);
  if (!instrument || heldUnits(desk.state, token) < instrument.lotSize) return "You don't hold this option.";
  for (const value of [changes.stop, changes.target]) {
    if (value != null && (!Number.isSafeInteger(value) || value <= 0 || value % instrument.tickSize !== 0)) return `Use prices in multiples of ₹${(instrument.tickSize / 100).toFixed(2)}.`;
  }
  const working = positionExits(desk, token);
  const stop = changes.stop === undefined ? working.stop?.triggerPrice : changes.stop ?? undefined;
  const target = changes.target === undefined ? working.target?.limitPrice : changes.target ?? undefined;
  if (stop !== undefined && target !== undefined && stop >= target) return "Set the stop-loss below the target.";
  if (lastPrice === undefined) return null;
  if (changes.stop != null && changes.stop >= lastPrice) return `Set the stop-loss below ${formatPaise(lastPrice, 2)}.`;
  if (changes.target != null && changes.target <= lastPrice) return `Set the target above ${formatPaise(lastPrice, 2)}.`;
  return null;
}

/**
 * What's wrong with a buy's stop-loss and target, or null. `price` is where the buy is expected to
 * fill (the last price for a market order, the limit or the trigger otherwise): the stop-loss goes
 * below it and the target above, both on the contract's tick.
 */
export function exitsProblem(exits: Exits, side: OrderRequest["side"], price: Paise | undefined, tick: number): string | null {
  if (exits.stop === undefined && exits.target === undefined) return null;
  if (side !== "BUY") return "A stop-loss and target go with a buy.";
  for (const value of [exits.stop, exits.target]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0 || value % tick !== 0)) return `Use prices in multiples of ₹${(tick / 100).toFixed(2)}.`;
  }
  if (exits.stop !== undefined && exits.target !== undefined && exits.stop >= exits.target) return "Set the stop-loss below the target.";
  if (price === undefined) return null;
  if (exits.stop !== undefined && exits.stop >= price) return `Set the stop-loss below ${formatPaise(price, 2)}.`;
  if (exits.target !== undefined && exits.target <= price) return `Set the target above ${formatPaise(price, 2)}.`;
  return null;
}

/** A new account on the plan's rules: a demo account (the evaluation), or the funded account a pass opens. */
export function openDesk(plan: EvaluationPlan, id: string, at: number, phase: AccountPhase = "EVALUATION"): Desk {
  const state = openAccount({ id, phase, rules: ruleSetFor(plan), at });
  const text = phase === "FUNDED" ? `Opened a ${plan.label} funded account.` : `Opened a ${plan.label} demo account.`;
  return { version: 1, state, instruments: [], fills: [], notes: [{ at, tone: "info", text }], orderBook: [], dayTrades: {} };
}

/** Quote keys (`exchange:tradingsymbol`) the host must keep fresh: held and ordered contracts. */
export const deskQuoteKeys = (desk: Desk) => desk.instruments.map((instrument) => `${instrument.exchange}:${instrument.tradingSymbol}`);

/**
 * Apply one event. `quotes` holds the host's latest quote per contract (update it before a quote
 * event); `instrument` adds the contract an order is for, and `exits` a stop-loss and target for a
 * buy. Times never run backwards: an event stamped before the account's clock is applied at the
 * clock. Stop-losses and targets are then placed, trimmed or cancelled as the event left things.
 */
export function deskStep(desk: Desk, event: EngineEvent, quotes: ReadonlyMap<number, Quote>, instrument?: Instrument, exits?: Exits): { desk: Desk; outputs: EngineOutput[] } {
  const bracketed = event.kind === "place" && event.order.side === "BUY" && exits !== undefined && (exits.stop !== undefined || exits.target !== undefined) && !(desk.brackets ?? []).some((item) => item.entryId === event.order.id);
  let start = bracketed ? { ...desk, brackets: [...(desk.brackets ?? []), { entryId: event.order.id, token: event.order.token, ...exits, status: "WAITING" as const }] } : desk;
  if (event.kind === "quote") start = stopBuysBeforeExits(start, event.quote, event.at, quotes);
  return followExits(applyEvent(start, event, quotes, instrument), quotes);
}

/**
 * Set, move or remove an open position's stop-loss and target after it was bought: a price moves
 * the exit already working, or places one for the whole position (its id made from `id`), and null
 * cancels it. Check the change with positionExitsProblem first. `quotes` as for deskStep.
 */
export function setPositionExits(desk: Desk, token: number, changes: ExitChanges, id: string, at: number, quotes: ReadonlyMap<number, Quote>): { desk: Desk; outputs: EngineOutput[] } {
  const steps = new Steps(desk, quotes, Math.max(at, desk.state.clock));
  setExits(steps, token, changes, id);
  return followExits({ desk: steps.desk, outputs: steps.outputs }, quotes);
}

/**
 * Before a quote that fills a position's stop-loss or target, cancel what is left of the buys that
 * set them, so the quote that closes the position can't add to it as well.
 */
function stopBuysBeforeExits(desk: Desk, quote: Quote, at: number, quotes: ReadonlyMap<number, Quote>): Desk {
  let next = desk;
  for (const bracket of desk.brackets ?? []) {
    const entry = next.state.orders.find((order) => order.id === bracket.entryId);
    if (bracket.status !== "ACTIVE" || bracket.token !== quote.token || !entry) continue;
    const { stop, target } = positionExits(next, bracket.token);
    const stopHit = stop?.type === "SL-M" && stop.triggerPrice !== undefined && quote.lastPrice <= stop.triggerPrice;
    const targetHit = target?.type === "LIMIT" && target.limitPrice !== undefined && quote.bids.some((level) => level.price >= target.limitPrice!);
    if (!stopHit && !targetHit) continue;
    const steps = new Steps(next, quotes, at);
    steps.cancel(entry, stopHit ? "Stop-loss hit" : "Target hit");
    next = steps.desk;
  }
  return next;
}

/** Activity notes for one engine output in place of the usual ones; undefined keeps the usual. */
type Describe = (output: EngineOutput) => DeskNote[] | undefined;

/** One engine step and its bookkeeping. `describe` can reword the step's activity notes. */
function applyEvent(desk: Desk, event: EngineEvent, quotes: ReadonlyMap<number, Quote>, instrument?: Instrument, describe?: Describe): { desk: Desk; outputs: EngineOutput[] } {
  const known = new Map(desk.instruments.map((item) => [item.token, item]));
  if (instrument) known.set(instrument.token, instrument);
  const context: EngineContext = {
    instrument: (token) => known.get(token),
    quote: (token) => quotes.get(token),
    isTradingDay: isWeekday,
    charges: CHARGES_SCHEDULES,
    ...DESK_SETTINGS,
  };
  const applied = { ...event, at: Math.max(event.at, desk.state.clock) };
  const { state, outputs } = step(desk.state, applied, context);
  const live = new Set([...state.positions.map((position) => position.instrument.token), ...state.orders.map((order) => order.token)]);
  const symbol = (token: number) => known.get(token)?.tradingSymbol ?? String(token);
  const notes = outputs.flatMap((output) => describe?.(output) ?? noteFor(output, symbol, event.kind)).reverse();
  const fills = outputs.flatMap((output) => (output.kind === "fill" ? [output.fill] : []));
  const dayTrades = { ...desk.dayTrades };
  for (const fill of fills) {
    const date = toIst(fill.at).date;
    dayTrades[date] = (dayTrades[date] ?? 0) + 1;
  }
  return {
    desk: {
      version: 1,
      state,
      instruments: [...known.values()].filter((item) => live.has(item.token)),
      fills: [...[...fills].reverse(), ...desk.fills].slice(0, FILLS_KEPT),
      notes: [...notes, ...desk.notes].slice(0, NOTES_KEPT),
      orderBook: recordOrders(desk.orderBook ?? [], applied, outputs, known),
      dayTrades,
      ...(desk.brackets?.length ? { brackets: desk.brackets } : {}),
    },
    outputs,
  };
}

const heldUnits = (state: AccountState, token: number) => {
  const position = state.positions.find((item) => item.instrument.token === token);
  return position ? netQuantity(position) : 0;
};

/** Engine events the desk applies itself (exits and their cancels), one after another at one time, with every output kept. */
class Steps {
  readonly outputs: EngineOutput[];

  constructor(public desk: Desk, private readonly quotes: ReadonlyMap<number, Quote>, readonly at: number, outputs: readonly EngineOutput[] = []) {
    this.outputs = [...outputs];
  }

  run(event: EngineEvent, describe?: Describe): EngineOutput[] {
    const next = applyEvent(this.desk, event, this.quotes, undefined, describe);
    this.desk = next.desk;
    this.outputs.push(...next.outputs);
    return next.outputs;
  }

  working(id: string): WorkingOrder | undefined {
    return this.desk.state.orders.find((order) => order.id === id);
  }

  symbol(token: number): string {
    return this.desk.instruments.find((item) => item.token === token)?.tradingSymbol ?? String(token);
  }

  lotSize(token: number): number {
    return this.desk.instruments.find((item) => item.token === token)?.lotSize ?? 0;
  }

  note(note: DeskNote) {
    this.desk = { ...this.desk, notes: [note, ...this.desk.notes].slice(0, NOTES_KEPT) };
  }

  /** Cancel an exit or what's left of a buy and say why, in the order book and the activity log. */
  cancel(order: WorkingOrder, why: string) {
    const role = exitRole(order.id);
    const text = `${role === "stop" ? "Stop-loss" : role === "target" ? "Target" : "Entry remainder"} on ${this.symbol(order.token)} cancelled: ${why.toLowerCase()}.`;
    this.run({ kind: "cancel", at: this.at, orderId: order.id }, (output) => (output.kind === "cancelled" ? [{ at: output.at, tone: "info", text }] : undefined));
    this.desk = { ...this.desk, orderBook: this.desk.orderBook?.map((record) => (record.id === order.id && record.status === "CANCELLED" ? { ...record, reason: why } : record)) };
  }
}

/**
 * Set a position's exits (`changes` as for setPositionExits) for the whole of it: move the one
 * working or place a new one, its id `base` plus -SL or -TP. Notes say what was done, or why not.
 */
function setExits(steps: Steps, token: number, changes: ExitChanges, base: string) {
  const symbol = steps.symbol(token);
  const placed: string[] = [];
  let placedLots = 0;
  for (const role of ["stop", "target"] as const) {
    const price = changes[role];
    if (price === undefined) continue;
    const name = role === "stop" ? "Stop-loss" : "Target";
    const working = positionExits(steps.desk, token)[role];
    if (price === null) {
      if (working) steps.run({ kind: "cancel", at: steps.at, orderId: working.id }, (output) => (output.kind === "cancelled" ? [{ at: output.at, tone: "info", text: `${name} on ${symbol} removed.` }] : undefined));
      continue;
    }
    if (working) {
      steps.run({ kind: "modify", at: steps.at, orderId: working.id, changes: role === "stop" ? { triggerPrice: price } : { limitPrice: price } }, (output) => (
        output.kind === "modified" ? [{ at: output.at, tone: "info", text: `${name} on ${symbol} moved to ${money(price)}.` }]
          : output.kind === "rejected" ? [{ at: output.at, tone: "bad", text: `${name} not moved: ${output.message}` }]
            : undefined
      ));
      continue;
    }
    const lotSize = steps.lotSize(token);
    const lots = lotSize > 0 ? Math.floor(heldUnits(steps.desk.state, token) / lotSize) : 0;
    if (lots < 1) continue;
    const order: OrderRequest = role === "stop"
      ? { id: `${base}${STOP_SUFFIX}`, token, side: "SELL", lots, type: "SL-M", triggerPrice: price }
      : { id: `${base}${TARGET_SUFFIX}`, token, side: "SELL", lots, type: "LIMIT", limitPrice: price };
    const outputs = steps.run({ kind: "place", at: steps.at, order }, (output) => (output.kind === "rejected" ? [{ at: output.at, tone: "bad", text: `${name} not placed: ${output.message}` }] : undefined));
    if (outputs.some((output) => output.kind === "rejected")) continue;
    placed.push(`${name.toLowerCase()} at ${money(price)}`);
    placedLots = lots;
  }
  if (placed.length > 0) steps.note({ at: steps.at, tone: "info", text: `Working a ${placed.join(" and a ")} for ${placedLots} lot${placedLots === 1 ? "" : "s"} of ${symbol}.` });
}

/** One cancels the other: an exit that filled in full (among `outputs`) cancels the rest on its contract, the other exit and what's left of the buys that set them. */
function oneCancelsOther(steps: Steps, outputs: readonly EngineOutput[], brackets: readonly Bracket[]) {
  const hit = new Map<number, string>();
  for (const output of outputs) {
    const role = output.kind === "fill" && output.fill.orderId !== null ? exitRole(output.fill.orderId) : null;
    if (output.kind !== "fill" || !role || steps.desk.orderBook?.find((record) => record.id === output.fill.orderId)?.status !== "COMPLETE") continue;
    hit.set(output.fill.token, role === "stop" ? "Stop-loss hit" : "Target hit");
  }
  for (const [token, why] of hit) {
    for (const { id } of steps.desk.state.orders.filter((order) => order.token === token)) {
      const order = steps.working(id);
      const entry = brackets.some((bracket) => bracket.status === "ACTIVE" && bracket.entryId === id);
      if (order && (exitRole(id) || entry)) steps.cancel(order, why);
    }
  }
}

/**
 * Bring every position's exits in line with the account after a step, inside the same write: one
 * cancels the other, a buy that has filled sets its exits, and exits are trimmed or grown to the
 * units held, or cancelled once the position is closed. Buys still working keep their brackets.
 */
function followExits(result: { desk: Desk; outputs: EngineOutput[] }, quotes: ReadonlyMap<number, Quote>): { desk: Desk; outputs: EngineOutput[] } {
  if (!result.desk.brackets?.length && !result.desk.state.orders.some((order) => exitRole(order.id))) return result;
  const steps = new Steps(result.desk, quotes, result.desk.state.clock, result.outputs);
  const brackets: Bracket[] = (result.desk.brackets ?? []).map(({ entryId, token, stop, target, status }) => ({ entryId, token, ...(stop !== undefined ? { stop } : {}), ...(target !== undefined ? { target } : {}), status }));
  oneCancelsOther(steps, result.outputs, brackets);
  for (const bracket of brackets) {
    const lotSize = steps.lotSize(bracket.token);
    const filled = steps.desk.orderBook?.find((record) => record.id === bracket.entryId)?.filled ?? 0;
    if (bracket.status !== "WAITING" || lotSize === 0 || filled < lotSize || heldUnits(steps.desk.state, bracket.token) < lotSize) continue;
    bracket.status = "ACTIVE";
    const from = steps.outputs.length;
    setExits(steps, bracket.token, { stop: bracket.stop, target: bracket.target }, bracket.entryId);
    oneCancelsOther(steps, steps.outputs.slice(from), brackets);
  }
  // An exit never sells more than is held, and covers all of it.
  for (const { id } of steps.desk.state.orders.filter((order) => exitRole(order.id))) {
    const order = steps.working(id);
    if (!order) continue;
    const lotSize = steps.lotSize(order.token);
    const held = heldUnits(steps.desk.state, order.token);
    if (lotSize === 0 || held < lotSize) steps.cancel(order, "Position closed");
    else {
      const lots = Math.floor((order.filled + held) / lotSize);
      if (lots !== order.lots) steps.run({ kind: "modify", at: steps.at, orderId: id, changes: { lots } }, () => []);
    }
  }
  const kept = brackets.filter((bracket) => steps.working(bracket.entryId));
  const next: Desk = { ...steps.desk };
  if (kept.length > 0) next.brackets = kept;
  else delete next.brackets;
  return { desk: next, outputs: steps.outputs };
}

/** Short reasons for the order book's Cancelled rows. */
const CANCELLED_WHY: Record<CancelReason, string> = {
  TRADER: "Cancelled by you",
  SQUARE_OFF: "15:20 square-off",
  BREACH: "A loss limit was hit",
  LOT_LIMIT: "Would pass your lot limit",
  NAKED_SHORT: "Would leave a naked short option",
};

/** The order book after one event: a placed order opens a row, and fills, changes and cancels update it. */
function recordOrders(book: readonly OrderRecord[], event: EngineEvent, outputs: readonly EngineOutput[], known: ReadonlyMap<number, Instrument>): OrderRecord[] {
  const records = [...book];
  const index = new Map(records.map((record, position) => [record.id, position]));
  const update = (id: string, change: (record: OrderRecord) => OrderRecord) => {
    const position = index.get(id);
    if (position !== undefined) records[position] = change(records[position]);
  };
  // A repeated order id is rejected by the engine and must not touch the original row.
  const placed = event.kind === "place" && !index.has(event.order.id) ? event.order : null;
  if (placed) {
    const instrument = known.get(placed.token);
    records.unshift({
      id: placed.id,
      token: placed.token,
      tradingSymbol: instrument?.tradingSymbol ?? String(placed.token),
      side: placed.side,
      type: placed.type,
      lots: placed.lots,
      quantity: placed.lots * (instrument?.lotSize ?? 0),
      filled: 0,
      ...(placed.limitPrice !== undefined && (placed.type === "LIMIT" || placed.type === "SL") ? { limitPrice: placed.limitPrice } : {}),
      ...(placed.triggerPrice !== undefined && (placed.type === "SL" || placed.type === "SL-M") ? { triggerPrice: placed.triggerPrice } : {}),
      averagePrice: null,
      placedAt: event.at,
      updatedAt: event.at,
      status: "OPEN",
    });
    for (const [id, position] of index) index.set(id, position + 1);
    index.set(placed.id, 0);
  }
  for (const output of outputs) {
    switch (output.kind) {
      case "rejected":
        // A refused change or cancel leaves the order as it was; only a refused new order is Rejected.
        if (placed && output.orderId === placed.id) update(output.orderId, (record) => ({ ...record, status: "REJECTED", reason: output.message, updatedAt: output.at }));
        break;
      case "modified":
        if (event.kind === "modify") {
          const { changes } = event;
          update(output.orderId, (record) => ({
            ...record,
            ...(changes.lots !== undefined ? { lots: changes.lots, quantity: changes.lots * (known.get(record.token)?.lotSize ?? 0) } : {}),
            ...(changes.limitPrice !== undefined && record.limitPrice !== undefined ? { limitPrice: changes.limitPrice } : {}),
            ...(changes.triggerPrice !== undefined && record.triggerPrice !== undefined ? { triggerPrice: changes.triggerPrice } : {}),
            updatedAt: output.at,
          }));
        }
        break;
      case "fill": {
        const { fill } = output;
        if (fill.orderId === null) break;
        update(fill.orderId, (record) => {
          const filled = record.filled + fill.quantity;
          const averagePrice = Math.round(((record.averagePrice ?? 0) * record.filled + fill.price * fill.quantity) / filled);
          return { ...record, filled, averagePrice, status: filled >= record.quantity ? "COMPLETE" : record.status, updatedAt: fill.at };
        });
        break;
      }
      case "cancelled":
        update(output.orderId, (record) => ({ ...record, status: "CANCELLED", reason: CANCELLED_WHY[output.reason], updatedAt: output.at }));
        break;
    }
  }
  return records.slice(0, ORDERS_KEPT);
}

const money = (paise: number) => formatPaise(paise, 2);

/** A plain-English line for the activity log, or nothing for routine acknowledgements. `event` is what was applied. */
export function noteFor(output: EngineOutput, symbol: (token: number) => string, event?: EngineEvent["kind"]): DeskNote[] {
  switch (output.kind) {
    case "accepted":
    case "payout-debited":
      return [];
    case "rejected": {
      const what = event === "modify" ? "Change refused" : event === "cancel" ? "Cancel refused" : "Order rejected";
      return [{ at: output.at, tone: "bad", text: `${what}: ${output.message}` }];
    }
    case "modified":
      return [{ at: output.at, tone: "info", text: "Order modified." }];
    case "triggered":
      return [{ at: output.at, tone: "info", text: "Stop order triggered." }];
    case "cancelled": {
      const why = { TRADER: "Order cancelled.", SQUARE_OFF: "Order cancelled at the 15:20 square-off.", BREACH: "Order cancelled: a loss limit was hit.", LOT_LIMIT: "Order cancelled: it would pass your lot limit.", NAKED_SHORT: "Order cancelled: it would leave a naked short option." }[output.reason];
      return [{ at: output.at, tone: output.reason === "TRADER" ? "info" : "bad", text: why }];
    }
    case "fill": {
      const { fill } = output;
      const how = fill.reason === "SQUARE_OFF" ? " at the 15:20 square-off" : fill.reason === "BREACH" ? " to close after a limit was hit" : "";
      const realised = fill.realised !== 0 ? `, realised ${money(fill.realised)}` : "";
      return [{ at: fill.at, tone: fill.reason === "BREACH" ? "bad" : "good", text: `${fill.side === "BUY" ? "Bought" : "Sold"} ${fill.quantity} ${symbol(fill.token)} at ${money(fill.price)}${how}${realised}; charges ${money(fill.charges.total)}.` }];
    }
    case "breach": {
      const rules = output.report.rules.map((rule) => (rule === "DAILY_LOSS" ? "daily loss limit" : "max drawdown")).join(" and ");
      return [{ at: output.report.at, tone: "bad", text: `Account failed: ${rules} hit at equity ${money(output.report.equity)}. Positions closed.` }];
    }
    case "day-closed":
      return [{ at: output.at, tone: "info", text: `${output.date} closed: net ${money(output.net)}, balance ${money(output.balance)}, ${output.tradingDays} trading day${output.tradingDays === 1 ? "" : "s"}.` }];
    case "passed":
      return [{ at: output.at, tone: "good", text: `Evaluation passed on ${output.date} with ${money(output.profit)} profit.` }];
  }
}

/** A price to mark on a contract's chart: the position's average, a stop-loss, a target or another working order. */
export interface ChartLine {
  price: Paise;
  title: string;
  tone: "average" | "stop" | "target" | "order";
  /** The working order at this price; the average has none. */
  orderId?: string;
  /** Units: the position's (positive long) on the average, still to fill on an order. */
  quantity: number;
}

/** The lines for a contract's chart: the open position's average price and every working order's price. */
export function chartLines(desk: Desk, token: number): ChartLine[] {
  const lines: ChartLine[] = [];
  const position = desk.state.positions.find((item) => item.instrument.token === token);
  const quantity = position ? netQuantity(position) : 0;
  if (position && quantity !== 0) {
    const cost = position.open.reduce((sum, lot) => sum + lot.price * lot.quantity, 0);
    lines.push({ price: divRound(Math.abs(cost), Math.abs(quantity)), title: `Avg ${quantity > 0 ? "+" : ""}${quantity}`, tone: "average", quantity });
  }
  for (const order of desk.state.orders) {
    if (order.token !== token) continue;
    const role = exitRole(order.id);
    const line = { orderId: order.id, quantity: order.quantity - order.filled };
    if (role === "stop" && order.triggerPrice !== undefined) lines.push({ price: order.triggerPrice, title: "SL", tone: "stop", ...line });
    else if (role === "target" && order.limitPrice !== undefined) lines.push({ price: order.limitPrice, title: "TP", tone: "target", ...line });
    else {
      const at = order.type === "LIMIT" ? order.limitPrice : order.triggerPrice;
      if (at !== undefined) lines.push({ price: at, title: `${order.side === "BUY" ? "Buy" : "Sell"} ${order.type}`, tone: "order", ...line });
    }
  }
  return lines;
}

/** One contract traded today, as a broker's positions screen shows it: open or closed, with its P&L. */
export interface DayPosition {
  token: number;
  tradingSymbol: string;
  /** Null when the contract has been closed and is no longer on the desk. */
  lotSize: number | null;
  /** Open units now: positive long, negative short. */
  quantity: number;
  /** Average price of the open units, first in first out; 0 when flat. */
  averagePrice: Paise;
  /** Last price; for a closed position, the last fill price. */
  mark: Paise;
  buyQuantity: number;
  buyValue: Paise;
  sellQuantity: number;
  sellValue: Paise;
  /** Gross P&L closed today. */
  realised: Paise;
  /** P&L on the open units at the mark. */
  unrealised: Paise;
  /** Charges on today's fills. */
  charges: Paise;
}

/**
 * Today's positions: every contract with a fill on `date` (IST) or still open, built from the
 * desk's recent fills and the engine's open lots. The desk keeps the newest {@link FILLS_KEPT}
 * fills, so a very busy day can drop its earliest fills from the buy and sell columns.
 */
export function dayPositions(desk: Desk, date: string): DayPosition[] {
  const rows = new Map<number, DayPosition>();
  const row = (token: number, tradingSymbol: string): DayPosition => {
    let found = rows.get(token);
    if (!found) {
      found = { token, tradingSymbol, lotSize: null, quantity: 0, averagePrice: 0, mark: 0, buyQuantity: 0, buyValue: 0, sellQuantity: 0, sellValue: 0, realised: 0, unrealised: 0, charges: 0 };
      rows.set(token, found);
    }
    return found;
  };
  // Oldest first, so a closed position's mark ends on its last fill.
  for (const fill of [...desk.fills].reverse()) {
    if (toIst(fill.at).date !== date) continue;
    const position = row(fill.token, fill.tradingSymbol);
    if (fill.side === "BUY") {
      position.buyQuantity += fill.quantity;
      position.buyValue += fill.price * fill.quantity;
    } else {
      position.sellQuantity += fill.quantity;
      position.sellValue += fill.price * fill.quantity;
    }
    position.realised += fill.realised;
    position.charges += fill.charges.total;
    position.mark = fill.price;
  }
  for (const open of desk.state.positions) {
    const position = row(open.instrument.token, open.instrument.tradingSymbol);
    const quantity = netQuantity(open);
    const cost = open.open.reduce((sum, lot) => sum + lot.price * lot.quantity, 0);
    position.lotSize = open.instrument.lotSize;
    position.quantity = quantity;
    position.averagePrice = quantity === 0 ? 0 : divRound(Math.abs(cost), Math.abs(quantity));
    position.mark = open.mark;
    position.unrealised = unrealisedPnl(open);
  }
  for (const instrument of desk.instruments) {
    const position = rows.get(instrument.token);
    if (position) position.lotSize = instrument.lotSize;
  }
  // Open positions first, then closed ones; each by contract.
  return [...rows.values()].sort((a, b) => Number(b.quantity !== 0) - Number(a.quantity !== 0) || a.tradingSymbol.localeCompare(b.tradingSymbol));
}

/** Today's P&L across positions: realised and open P&L, charges, and the net of the three. */
export function dayTotals(positions: readonly DayPosition[]): { realised: Paise; unrealised: Paise; charges: Paise; net: Paise } {
  const realised = positions.reduce((sum, position) => sum + position.realised, 0);
  const unrealised = positions.reduce((sum, position) => sum + position.unrealised, 0);
  const charges = positions.reduce((sum, position) => sum + position.charges, 0);
  return { realised, unrealised, charges, net: realised + unrealised - charges };
}
