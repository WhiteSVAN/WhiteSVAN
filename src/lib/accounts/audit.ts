/**
 * The trade and activity audit (pure): what one write of an account's desk added, as rows for
 * AccountFill and AccountEvent. The store writes them in the same transaction as the desk, so the
 * audit can't drift from the account; the desk itself keeps only its latest 200 fills and orders.
 * Event keys are unique per account, and the backfill migration (20261027100000_admin_audit) uses
 * the same ones, so a retried write or a backfilled order is recorded once.
 */
import type { AccountEventKind, Prisma } from "@/generated/prisma/client";
import { exitRole, type Desk, type OrderRecord } from "@/lib/trading/desk";
import type { Fill, OrderType } from "@/lib/trading/engine";
import type { Side } from "@/lib/trading/instruments";
import { toIst } from "@/lib/trading/time";

export interface AuditEvent {
  key: string;
  kind: AccountEventKind;
  orderId: string | null;
  at: number;
  detail: Record<string, unknown>;
}

export interface AuditDelta {
  /** Oldest first. */
  fills: Fill[];
  events: AuditEvent[];
}

export interface AuditOwner {
  id: string;
  userId: string;
}

const orderDetail = (record: OrderRecord) => ({
  tradingSymbol: record.tradingSymbol,
  token: record.token,
  side: record.side,
  type: record.type,
  lots: record.lots,
  quantity: record.quantity,
  limitPrice: record.limitPrice ?? null,
  triggerPrice: record.triggerPrice ?? null,
  exit: exitRole(record.id),
});

const terms = (record: OrderRecord) => ({ lots: record.lots, limitPrice: record.limitPrice ?? null, triggerPrice: record.triggerPrice ?? null });

/** What `after` adds to `before`: new fills, orders placed, changed, cancelled or rejected, a breach and a pass. */
export function auditDelta(before: Desk, after: Desk): AuditDelta {
  const known = new Set(before.fills.map((fill) => fill.id));
  const fills = after.fills.filter((fill) => !known.has(fill.id)).reverse();
  const events: AuditEvent[] = [];
  const previous = new Map((before.orderBook ?? []).map((record) => [record.id, record]));
  for (const record of [...(after.orderBook ?? [])].reverse()) {
    const old = previous.get(record.id);
    if (!old) {
      const rejected = record.status === "REJECTED";
      events.push({ key: `order:${record.id}:${rejected ? "rejected" : "placed"}`, kind: rejected ? "ORDER_REJECTED" : "ORDER_PLACED", orderId: record.id, at: record.placedAt, detail: { ...orderDetail(record), reason: rejected ? record.reason ?? null : null } });
    } else if (JSON.stringify(terms(old)) !== JSON.stringify(terms(record))) {
      events.push({ key: `order:${record.id}:modified:${record.updatedAt}`, kind: "ORDER_MODIFIED", orderId: record.id, at: record.updatedAt, detail: { tradingSymbol: record.tradingSymbol, side: record.side, type: record.type, from: terms(old), to: terms(record) } });
    }
    if (record.status === "CANCELLED" && old?.status !== "CANCELLED") {
      events.push({ key: `order:${record.id}:cancelled`, kind: "ORDER_CANCELLED", orderId: record.id, at: record.updatedAt, detail: { tradingSymbol: record.tradingSymbol, side: record.side, type: record.type, lots: record.lots, quantity: record.quantity, filled: record.filled, reason: record.reason ?? null } });
    }
  }
  const breach = after.state.breach;
  if (breach && !before.state.breach) events.push({ key: "breach", kind: "BREACH", orderId: null, at: breach.at, detail: { ...breach } });
  if (after.state.status === "PASSED" && before.state.status !== "PASSED") {
    const { balance, rules, passedOn, days, clock } = after.state;
    events.push({ key: "passed", kind: "PASSED", orderId: null, at: clock, detail: { date: passedOn, balance, profit: balance - rules.startingBalance, tradingDays: days.length } });
  }
  return { fills, events };
}

export const auditIsEmpty = (delta: AuditDelta) => delta.fills.length === 0 && delta.events.length === 0;

export function fillRow(owner: AuditOwner, fill: Fill): Prisma.AccountFillCreateManyInput {
  return {
    accountId: owner.id,
    userId: owner.userId,
    fillId: fill.id,
    orderId: fill.orderId,
    reason: fill.reason,
    token: fill.token,
    tradingSymbol: fill.tradingSymbol,
    side: fill.side,
    quantity: fill.quantity,
    price: fill.price,
    realised: fill.realised,
    charges: { ...fill.charges },
    chargesTotal: fill.charges.total,
    chargesSchedule: fill.chargesSchedule,
    balanceAfter: fill.balanceAfter,
    at: new Date(fill.at),
    tradeDate: new Date(`${toIst(fill.at).date}T00:00:00Z`),
  };
}

export function eventRow(owner: AuditOwner, event: AuditEvent): Prisma.AccountEventCreateManyInput {
  return { accountId: owner.id, userId: owner.userId, key: event.key, kind: event.kind, orderId: event.orderId, at: new Date(event.at), detail: event.detail as Prisma.InputJsonValue };
}

/** An order the trading policy refused before the engine saw it, such as a hedge across accounts. */
export function refusalEvent(order: { id: string; token: number; tradingSymbol: string; side: Side; lots: number; type: OrderType }, reason: string, at: number): AuditEvent {
  return { key: `refused:${order.id}`, kind: "ORDER_REFUSED", orderId: order.id, at, detail: { tradingSymbol: order.tradingSymbol, token: order.token, side: order.side, type: order.type, lots: order.lots, reason } };
}
