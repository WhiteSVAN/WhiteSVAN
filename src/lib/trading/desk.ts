/**
 * In-memory host for one simulated account, the way the engine service will host many: it keeps
 * the contracts the account has ordered or held, applies events in time order against the host's
 * latest quotes, and keeps a short log of fills and activity. JSON-serialisable, so the owner's
 * test desk on /markets keeps it in the browser and a server can store it. Pure: callers pass
 * every time and quote in.
 */
import type { EvaluationPlan } from "../prop-firm";
import { CHARGES_SCHEDULES } from "./charges-schedules";
import { openAccount, step, type AccountState, type EngineContext, type EngineEvent, type EngineOutput, type Fill } from "./engine";
import type { Instrument } from "./instruments";
import type { Quote } from "./matching";
import { formatPaise } from "./money";
import { ruleSetFor } from "./rules";
import { isWeekday } from "./time";

/** One tick of slippage on market fills (as in the engine's realistic tests); TRD MD-3 staleness. */
export const DESK_SETTINGS = { slippageTicks: 1, staleAfterMs: 5_000 } as const;
const FILLS_KEPT = 200;
const NOTES_KEPT = 100;

export interface DeskNote {
  at: number;
  tone: "good" | "bad" | "info";
  text: string;
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
}

export function openDesk(plan: EvaluationPlan, id: string, at: number): Desk {
  const state = openAccount({ id, phase: "EVALUATION", rules: ruleSetFor(plan), at });
  return { version: 1, state, instruments: [], fills: [], notes: [{ at, tone: "info", text: `Opened a ${plan.label} evaluation account.` }] };
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
  const { state, outputs } = step(desk.state, { ...event, at: Math.max(event.at, desk.state.clock) }, context);
  const live = new Set([...state.positions.map((position) => position.instrument.token), ...state.orders.map((order) => order.token)]);
  const symbol = (token: number) => known.get(token)?.tradingSymbol ?? String(token);
  const notes = outputs.flatMap((output) => noteFor(output, symbol)).reverse();
  return {
    desk: {
      version: 1,
      state,
      instruments: [...known.values()].filter((item) => live.has(item.token)),
      fills: [...outputs.flatMap((output) => (output.kind === "fill" ? [output.fill] : [])).reverse(), ...desk.fills].slice(0, FILLS_KEPT),
      notes: [...notes, ...desk.notes].slice(0, NOTES_KEPT),
    },
    outputs,
  };
}

const money = (paise: number) => formatPaise(paise, 2);

/** A plain-English line for the activity log, or nothing for routine acknowledgements. */
export function noteFor(output: EngineOutput, symbol: (token: number) => string): DeskNote[] {
  switch (output.kind) {
    case "accepted":
    case "payout-debited":
      return [];
    case "rejected":
      return [{ at: output.at, tone: "bad", text: `Order rejected: ${output.message}` }];
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
