import type { Paise } from "./money";

export type Exchange = "NFO" | "BFO";
export type Underlying = "NIFTY" | "BANKNIFTY" | "SENSEX";
export type InstrumentKind = "FUT" | "CE" | "PE";
export type Side = "BUY" | "SELL";

/**
 * One row of the dated contract master (TRD RD-2). Lot, tick and freeze sizes come from the
 * exchange file for the trading day; never hard-code them.
 */
export interface Instrument {
  token: number;
  exchange: Exchange;
  tradingSymbol: string;
  underlying: Underlying;
  kind: InstrumentKind;
  /** Expiry date in IST, `YYYY-MM-DD`. */
  expiry: string;
  strike: Paise | null;
  /** Units per lot. */
  lotSize: number;
  tickSize: Paise;
  /** Largest order the exchange accepts, in units. */
  freezeQuantity: number;
}

export const isOption = (instrument: Pick<Instrument, "kind">) => instrument.kind !== "FUT";

/** Contract-master sanity checks; returns a problem description or null. */
export function instrumentProblem(instrument: Instrument): string | null {
  const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
  if (!positive(instrument.token)) return "token must be a positive integer";
  if (!positive(instrument.lotSize)) return "lot size must be a positive integer";
  if (!positive(instrument.tickSize)) return "tick size must be a positive number of paise";
  if (!positive(instrument.freezeQuantity)) return "freeze quantity must be a positive integer";
  if (instrument.freezeQuantity < instrument.lotSize) return "freeze quantity is below one lot";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(instrument.expiry)) return "expiry must be YYYY-MM-DD";
  if (isOption(instrument) ? !(instrument.strike !== null && positive(instrument.strike)) : instrument.strike !== null) {
    return "options need a positive strike and futures none";
  }
  return null;
}

export interface Holding {
  instrument: Instrument;
  /** Signed open units: positive long, negative short. */
  quantity: number;
}

export interface Exposure {
  /** Lots counted against the account's position limit. */
  lots: number;
  /** Short option lots not covered by a long option of the same underlying, expiry and type. */
  nakedShortLots: number;
}

/**
 * Lots in use under the programme's position limit:
 * - futures count their absolute net lots;
 * - options are grouped by underlying, expiry and type (CE or PE). Long lots count; a short lot
 *   covered by a long lot in the same group is a defined-risk spread leg and adds nothing; an
 *   uncovered short lot is a naked short option, which the rules do not allow.
 */
export function exposure(holdings: readonly Holding[]): Exposure {
  let lots = 0;
  let nakedShortLots = 0;
  const groups = new Map<string, { long: number; short: number }>();
  for (const { instrument, quantity } of holdings) {
    if (quantity === 0) continue;
    const held = Math.ceil(Math.abs(quantity) / instrument.lotSize);
    if (!isOption(instrument)) {
      lots += held;
      continue;
    }
    const key = `${instrument.underlying}|${instrument.expiry}|${instrument.kind}`;
    const group = groups.get(key) ?? { long: 0, short: 0 };
    if (quantity > 0) group.long += held;
    else group.short += held;
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    lots += group.long;
    nakedShortLots += Math.max(0, group.short - group.long);
  }
  return { lots, nakedShortLots };
}
