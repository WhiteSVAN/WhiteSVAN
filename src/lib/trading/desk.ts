/**
 * In-memory host for one simulated account, the way the engine service will host many: it keeps
 * the contracts the account has ordered or held, applies events in time order against the host's
 * latest quotes, and keeps the order book and a short log of fills and activity. JSON-serialisable,
 * so the server stores it whole (EvaluationAccount.desk). Pure: callers pass every time and quote in.
 */
import type { EvaluationPlan } from "../prop-firm";
import { CHARGES_SCHEDULES } from "./charges-schedules";
import { netQuantity, openAccount, step, unrealisedPnl, type AccountPhase, type AccountState, type CancelReason, type EngineContext, type EngineEvent, type EngineOutput, type Fill, type OrderType } from "./engine";
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
 * event); `instrument` adds the contract an order is for. Times never run backwards: an event
 * stamped before the account's clock is applied at the clock.
 */
export function deskStep(desk: Desk, event: EngineEvent, quotes: ReadonlyMap<number, Quote>, instrument?: Instrument): { desk: Desk; outputs: EngineOutput[] } {
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
  const notes = outputs.flatMap((output) => noteFor(output, symbol, event.kind)).reverse();
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
    },
    outputs,
  };
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
