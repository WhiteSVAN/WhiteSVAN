import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { auditDelta, refusalEvent } from "@/lib/accounts/audit";
import { changeAccount, recordRefusal } from "@/lib/accounts/store";
import { prisma } from "@/lib/db";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { deskStep, openDesk, type Desk } from "@/lib/trading/desk";
import type { EngineEvent } from "@/lib/trading/engine";
import type { Instrument } from "@/lib/trading/instruments";
import type { Quote } from "@/lib/trading/matching";
import { ist } from "@/lib/trading/time";
import { eventsPage, fillsPage, latestEvents, loadBook } from "./book";
import { eventFilters, fillFilters } from "./filters";

const localDb = (() => {
  try { const url = new URL(process.env.DATABASE_URL ?? ""); return url.hostname === "127.0.0.1" && url.pathname === "/whitesvan_preview"; }
  catch { return false; }
})();

// Test fixtures, not exchange values.
const r = (rupees: number) => Math.round(rupees * 100);
const CALL: Instrument = { token: 501, exchange: "NFO", tradingSymbol: "NIFTY-25000-CE-ADMIN", underlying: "NIFTY", kind: "CE", expiry: "2026-11-24", strike: r(25_000), lotSize: 75, tickSize: 5, freezeQuantity: 1_800 };
const plan = findEvaluationPlan("1l")!;

/** Apply events to a desk the way the platform host does: a fresh quote with every order. */
function play(desk: Desk, steps: readonly { at: string; last: number; order?: { id: string; side: "BUY" | "SELL"; type?: "MARKET" | "LIMIT"; limitPrice?: number }; cancel?: string }[]): Desk {
  const quotes = new Map<number, Quote>();
  for (const step of steps) {
    const at = ist(step.at);
    const quote: Quote = { token: CALL.token, at, lastPrice: r(step.last), bids: [{ price: r(step.last) - 5, quantity: 5_000 }], asks: [{ price: r(step.last) + 5, quantity: 5_000 }] };
    quotes.set(CALL.token, quote);
    desk = deskStep(desk, { kind: "quote", at, quote }, quotes, CALL).desk;
    const event: EngineEvent | null = step.order
      ? { kind: "place", at, order: { id: step.order.id, token: CALL.token, side: step.order.side, lots: 1, type: step.order.type ?? "MARKET", ...(step.order.limitPrice ? { limitPrice: r(step.order.limitPrice) } : {}) } }
      : step.cancel ? { kind: "cancel", at, orderId: step.cancel } : null;
    if (event) desk = deskStep(desk, event, quotes, CALL).desk;
  }
  return desk;
}

/** A morning's trading: a limit order cancelled, a round trip for a profit, and a second buy that breaches the daily loss limit. */
const MORNING = [
  { at: "2026-11-02 09:20", last: 120, order: { id: "L1", side: "BUY" as const, type: "LIMIT" as const, limitPrice: 100 } },
  { at: "2026-11-02 09:21", last: 120, cancel: "L1" },
  { at: "2026-11-02 09:30", last: 120, order: { id: "B1", side: "BUY" as const } },
  { at: "2026-11-02 10:30", last: 140, order: { id: "S1", side: "SELL" as const } },
  { at: "2026-11-02 11:00", last: 140, order: { id: "B2", side: "BUY" as const } },
  { at: "2026-11-02 11:30", last: 80 },
];

describe.skipIf(!localDb)("admin audit and portal data (PostgreSQL integration)", () => {
  const userIds: string[] = [];

  async function trader(name: string) {
    const user = await prisma.user.create({ data: { email: `admin-it-${randomUUID()}@example.test`, name, role: "TRADER" } });
    userIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("records every fill and event with the desk's own write, once even when the write is retried", async () => {
    const user = await trader("Live Writer");
    const id = `ev-admin-${randomUUID()}`;
    const opened = openDesk(plan, id, ist("2026-11-02 09:00"));
    await prisma.evaluationAccount.create({ data: { id, userId: user.id, planId: plan.id, desk: opened as unknown as Prisma.InputJsonValue } });
    const final = play(opened, MORNING);
    await changeAccount(user.id, id, () => ({ desk: final, result: null }));

    const fills = await prisma.accountFill.findMany({ where: { accountId: id }, orderBy: { at: "asc" } });
    expect(fills.map((fill) => [fill.fillId, fill.side, fill.reason])).toEqual(final.fills.slice().reverse().map((fill) => [fill.id, fill.side, fill.reason]));
    expect(fills.every((fill) => fill.userId === user.id && fill.tradeDate.toISOString().startsWith("2026-11-02"))).toBe(true);
    const events = await prisma.accountEvent.findMany({ where: { accountId: id }, orderBy: [{ at: "asc" }, { key: "asc" }] });
    expect(events.map((event) => event.key).sort()).toEqual(["breach", "order:B1:placed", "order:B2:placed", "order:L1:cancelled", "order:L1:placed", "order:S1:placed"]);
    expect((await prisma.evaluationAccount.findUniqueOrThrow({ where: { id } })).status).toBe("FAILED");

    // The same additions again (a retried write after a conflict) find their rows already there.
    const current = await prisma.evaluationAccount.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      const delta = auditDelta(opened, current.desk as unknown as Desk);
      await tx.accountFill.createMany({ data: delta.fills.map((fill) => ({ accountId: id, userId: user.id, fillId: fill.id, orderId: fill.orderId, reason: fill.reason, token: fill.token, tradingSymbol: fill.tradingSymbol, side: fill.side, quantity: fill.quantity, price: fill.price, realised: fill.realised, charges: { ...fill.charges }, chargesTotal: fill.charges.total, chargesSchedule: fill.chargesSchedule, balanceAfter: fill.balanceAfter, at: new Date(fill.at), tradeDate: new Date("2026-11-02") })), skipDuplicates: true });
    });
    expect(await prisma.accountFill.count({ where: { accountId: id } })).toBe(fills.length);

    await recordRefusal({ id, userId: user.id }, refusalEvent({ id: "R1", token: CALL.token, tradingSymbol: CALL.tradingSymbol, side: "BUY", lots: 1, type: "MARKET" }, "No hedging across accounts.", ist("2026-11-02 12:00")));
    await recordRefusal({ id, userId: user.id }, refusalEvent({ id: "R1", token: CALL.token, tradingSymbol: CALL.tradingSymbol, side: "BUY", lots: 1, type: "MARKET" }, "No hedging across accounts.", ist("2026-11-02 12:00")));
    expect(await prisma.accountEvent.count({ where: { accountId: id, kind: "ORDER_REFUSED" } })).toBe(1);
  });

  it("backfills what desks already hold, with the keys the live writer uses", async () => {
    const user = await trader("Backfilled");
    const id = `ev-admin-${randomUUID()}`;
    const opened = openDesk(plan, id, ist("2026-11-02 09:00"));
    const final = play(opened, MORNING);
    // Stored directly, as accounts were before the audit existed: no audit rows yet.
    await prisma.evaluationAccount.create({ data: { id, userId: user.id, planId: plan.id, status: "FAILED", desk: final as unknown as Prisma.InputJsonValue } });
    expect(await prisma.accountFill.count({ where: { accountId: id } })).toBe(0);

    const migration = readFileSync(join(process.cwd(), "prisma/migrations/20261027100000_admin_audit/migration.sql"), "utf8");
    const backfill = migration.slice(migration.indexOf("-- Backfill from the desks."));
    for (const statement of backfill.split(/;\s*\n/).map((part) => part.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(statement);

    const fills = await prisma.accountFill.findMany({ where: { accountId: id } });
    expect(fills.map((fill) => fill.fillId).sort()).toEqual(final.fills.map((fill) => fill.id).sort());
    const byId = new Map(final.fills.map((fill) => [fill.id, fill]));
    for (const row of fills) {
      const fill = byId.get(row.fillId)!;
      expect({ price: row.price, quantity: row.quantity, realised: row.realised, chargesTotal: row.chargesTotal, balanceAfter: row.balanceAfter, at: row.at.getTime(), side: row.side, reason: row.reason, orderId: row.orderId })
        .toEqual({ price: fill.price, quantity: fill.quantity, realised: fill.realised, chargesTotal: fill.charges.total, balanceAfter: fill.balanceAfter, at: fill.at, side: fill.side, reason: fill.reason, orderId: fill.orderId });
    }
    const keys = (await prisma.accountEvent.findMany({ where: { accountId: id }, select: { key: true } })).map((event) => event.key).sort();
    expect(keys).toEqual(auditDelta(opened, final).events.map((event) => event.key).sort());
  });

  it("reads the book and filters fills and events for the portal", async () => {
    const user = await trader("Portal Reader");
    const id = `ev-admin-${randomUUID()}`;
    const opened = openDesk(plan, id, ist("2026-11-02 09:00"));
    await prisma.evaluationAccount.create({ data: { id, userId: user.id, planId: plan.id, desk: opened as unknown as Prisma.InputJsonValue } });
    await changeAccount(user.id, id, () => ({ desk: play(opened, MORNING.slice(0, 4)), result: null }));

    const { traders, accounts } = await loadBook({ userId: user.id });
    expect(traders).toHaveLength(1);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].trades).toMatchObject({ trades: 1, wins: 1 });
    expect(accounts[0].state.status).toBe("ACTIVE");

    const mine = await fillsPage(fillFilters({ q: "portal reader" }));
    expect(mine.count).toBe(2);
    expect(mine.rows.map((fill) => fill.side)).toEqual(["SELL", "BUY"]);
    expect((await fillsPage(fillFilters({ q: "portal reader", side: "BUY" }))).count).toBe(1);
    expect((await fillsPage(fillFilters({ account: id, from: "2026-11-03" }))).count).toBe(0);
    expect((await fillsPage(fillFilters({ account: id, from: "2026-11-02", to: "2026-11-02" }))).count).toBe(2);
    expect(mine.realised).toBeGreaterThan(0);

    const events = await eventsPage(eventFilters({ account: id, kind: "ORDER_CANCELLED" }));
    expect(events.rows.map((event) => event.orderId)).toEqual(["L1"]);
    expect((await latestEvents({ take: 10, accountId: id })).map((event) => event.kind)).toContain("ORDER_PLACED");
  });
});
