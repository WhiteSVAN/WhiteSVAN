/**
 * Indian F&O charges per simulated fill (TRD SIM-4, story S3-01). Rates live in dated schedules
 * (see charges-schedules.ts), never in this logic, so a rate change is a new schedule row and old
 * fills still replay with the schedule they were charged under.
 */
import { applyRate, assertPaise, type Paise } from "./money";
import type { Exchange, InstrumentKind, Side } from "./instruments";

export type Brokerage =
  | { kind: "flat"; perOrder: Paise }
  | { kind: "lower-of"; rate: number; perOrderCap: Paise };

export interface SegmentCharges {
  /** Charged once per executed order, however many fills it takes. */
  brokerage: Brokerage;
  /** Securities transaction tax on the sell side: traded value for futures, premium for options. */
  sttSell: number;
  /** Stamp duty on the buy side. */
  stampBuy: number;
  /** Exchange transaction charges by segment, as brokers bill them (NSE's includes IPFT). */
  transaction: Record<Exchange, number>;
}

export interface ChargesSchedule {
  id: string;
  /** First IST trading date the schedule applies to, `YYYY-MM-DD`. */
  effectiveFrom: string;
  source: string;
  /** True once a real contract note has been reproduced to the paisa with this schedule. */
  verified: boolean;
  futures: SegmentCharges;
  options: SegmentCharges;
  /** SEBI turnover fee, both sides. */
  sebi: number;
  /** GST on brokerage, transaction charges and the SEBI fee. */
  gst: number;
}

export interface ChargeBreakdown {
  brokerage: Paise;
  stt: Paise;
  transaction: Paise;
  sebi: Paise;
  stamp: Paise;
  gst: Paise;
  total: Paise;
}

export const NO_CHARGES: ChargeBreakdown = { brokerage: 0, stt: 0, transaction: 0, sebi: 0, stamp: 0, gst: 0, total: 0 };

export interface FillForCharges {
  kind: InstrumentKind;
  exchange: Exchange;
  side: Side;
  /** Price × units for this fill (premium for options). */
  turnover: Paise;
  /** Turnover already filled on the same order. */
  orderTurnoverBefore: Paise;
  /** Brokerage already charged on the same order. */
  brokerageChargedBefore: Paise;
}

/** The latest schedule in force on an IST date. */
export function scheduleFor(date: string, schedules: readonly ChargesSchedule[]): ChargesSchedule {
  let found: ChargesSchedule | undefined;
  for (const schedule of schedules) {
    if (schedule.effectiveFrom <= date && (!found || schedule.effectiveFrom > found.effectiveFrom)) found = schedule;
  }
  if (!found) throw new RangeError(`No charges schedule covers ${date}.`);
  return found;
}

function orderBrokerage(brokerage: Brokerage, orderTurnover: Paise): Paise {
  return brokerage.kind === "flat"
    ? brokerage.perOrder
    : Math.min(brokerage.perOrderCap, applyRate(orderTurnover, brokerage.rate));
}

export function chargesForFill(fill: FillForCharges, schedule: ChargesSchedule): ChargeBreakdown {
  assertPaise(fill.turnover, "Turnover");
  assertPaise(fill.orderTurnoverBefore, "Order turnover");
  assertPaise(fill.brokerageChargedBefore, "Brokerage charged");
  if (fill.turnover < 0 || fill.orderTurnoverBefore < 0 || fill.brokerageChargedBefore < 0) {
    throw new RangeError("Charges need non-negative amounts.");
  }
  const segment = fill.kind === "FUT" ? schedule.futures : schedule.options;
  const due = orderBrokerage(segment.brokerage, fill.orderTurnoverBefore + fill.turnover);
  const brokerage = Math.max(0, due - fill.brokerageChargedBefore);
  const stt = fill.side === "SELL" ? applyRate(fill.turnover, segment.sttSell) : 0;
  const stamp = fill.side === "BUY" ? applyRate(fill.turnover, segment.stampBuy) : 0;
  const transaction = applyRate(fill.turnover, segment.transaction[fill.exchange]);
  const sebi = applyRate(fill.turnover, schedule.sebi);
  const gst = applyRate(brokerage + transaction + sebi, schedule.gst);
  return { brokerage, stt, transaction, sebi, stamp, gst, total: brokerage + stt + transaction + sebi + stamp + gst };
}

export function sumCharges(items: readonly ChargeBreakdown[]): ChargeBreakdown {
  return items.reduce<ChargeBreakdown>((sum, item) => ({
    brokerage: sum.brokerage + item.brokerage,
    stt: sum.stt + item.stt,
    transaction: sum.transaction + item.transaction,
    sebi: sum.sebi + item.sebi,
    stamp: sum.stamp + item.stamp,
    gst: sum.gst + item.gst,
    total: sum.total + item.total,
  }), NO_CHARGES);
}
