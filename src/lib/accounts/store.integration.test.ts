import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { deskStep, openDesk, type Desk } from "@/lib/trading/desk";
import type { EngineEvent } from "@/lib/trading/engine";
import type { Instrument } from "@/lib/trading/instruments";
import type { Quote } from "@/lib/trading/matching";
import { ist } from "@/lib/trading/time";
import { changeAccount, loadAccounts } from "./store";

const localDb = (() => {
  try { const url = new URL(process.env.DATABASE_URL ?? ""); return url.hostname === "127.0.0.1" && url.pathname === "/whitesvan_preview"; }
  catch { return false; }
})();

// Test fixtures, not exchange values.
const r = (rupees: number) => Math.round(rupees * 100);
const CALL: Instrument = { token: 401, exchange: "NFO", tradingSymbol: "NIFTY-25000-CE-STORE", underlying: "NIFTY", kind: "CE", expiry: "2026-11-24", strike: r(25_000), lotSize: 75, tickSize: 5, freezeQuantity: 1_800 };
const DAYS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];
const plan = findEvaluationPlan("1l")!;

function apply(desk: Desk, quotes: Map<number, Quote>, event: EngineEvent): Desk {
  if (event.kind === "quote") quotes.set(event.quote.token, event.quote);
  return deskStep(desk, event, quotes, CALL).desk;
}

/** Five winning days (about ₹1,400 each on a ₹1L account), the last one left open as if the page was shut. */
function passingDesk(id: string): Desk {
  const quotes = new Map<number, Quote>();
  const quote = (at: number, last: number): Quote => ({ token: CALL.token, at, lastPrice: r(last), bids: [{ price: r(last) - 5, quantity: 5_000 }], asks: [{ price: r(last) + 5, quantity: 5_000 }] });
  let desk = openDesk(plan, id, ist(`${DAYS[0]} 09:00`));
  DAYS.forEach((day, index) => {
    const open = ist(`${day} 09:30`);
    const close = ist(`${day} 10:30`);
    desk = apply(desk, quotes, { kind: "quote", at: open, quote: quote(open, 120) });
    desk = apply(desk, quotes, { kind: "place", at: open, order: { id: `B${index}`, token: CALL.token, side: "BUY", lots: 1, type: "MARKET" } });
    desk = apply(desk, quotes, { kind: "quote", at: close, quote: quote(close, 140) });
    desk = apply(desk, quotes, { kind: "place", at: close, order: { id: `S${index}`, token: CALL.token, side: "SELL", lots: 1, type: "MARKET" } });
    if (index < DAYS.length - 1) desk = apply(desk, quotes, { kind: "clock", at: ist(`${day} 15:35`) });
  });
  return desk;
}

describe.skipIf(!localDb)("account store (PostgreSQL integration)", () => {
  const userIds: string[] = [];

  async function traderWithPassingDay() {
    const user = await prisma.user.create({ data: { email: `store-${randomUUID()}@example.test`, role: "TRADER" } });
    userIds.push(user.id);
    const id = `ev-store-${randomUUID()}`;
    await prisma.evaluationAccount.create({ data: { id, userId: user.id, planId: plan.id, desk: passingDesk(id) as unknown as Prisma.InputJsonValue } });
    return { userId: user.id, evaluationId: id };
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("closes a day nobody closed when the accounts load, and the pass opens one funded account", async () => {
    const { userId, evaluationId } = await traderWithPassingDay();
    const before = await prisma.evaluationAccount.findUniqueOrThrow({ where: { id: evaluationId } });
    expect(before.status).toBe("ACTIVE");

    const accounts = await loadAccounts(userId, ist("2026-11-09 09:00"));
    const evaluation = accounts.find((account) => account.id === evaluationId)!;
    const funded = accounts.find((account) => account.phase === "FUNDED")!;
    expect(evaluation).toMatchObject({ phase: "EVALUATION", status: "PASSED" });
    expect(evaluation.desk.state.passedOn).toBe("2026-11-06");
    expect(funded).toMatchObject({ planId: plan.id, status: "ACTIVE", fromAccountId: evaluationId });
    expect(funded.desk.state).toMatchObject({ phase: "FUNDED", status: "ACTIVE", balance: r(1_00_000), positions: [], days: [] });
    expect(funded.desk.state.rules).toEqual(openDesk(plan, "rules", 0).state.rules);

    // Loading again, or another write to the passed evaluation, opens nothing more.
    await loadAccounts(userId, ist("2026-11-09 10:00"));
    await changeAccount(userId, evaluationId, (desk) => ({ desk: deskStep(desk, { kind: "clock", at: ist("2026-11-09 11:00") }, new Map()).desk, result: null }));
    expect(await prisma.evaluationAccount.count({ where: { userId, phase: "FUNDED" } })).toBe(1);
  });

  it("opens the funded account from the platform's own write, once, when two writes race", async () => {
    const { userId, evaluationId } = await traderWithPassingDay();
    const close = (desk: Desk) => ({ desk: deskStep(desk, { kind: "clock", at: ist("2026-11-06 15:35") }, new Map()).desk, result: null });
    await Promise.all([changeAccount(userId, evaluationId, close), changeAccount(userId, evaluationId, close)]);
    expect((await prisma.evaluationAccount.findUniqueOrThrow({ where: { id: evaluationId } })).status).toBe("PASSED");
    expect(await prisma.evaluationAccount.count({ where: { userId, phase: "FUNDED", fromAccountId: evaluationId } })).toBe(1);
  });

  it("leaves a day still trading alone", async () => {
    const { userId, evaluationId } = await traderWithPassingDay();
    const version = (await prisma.evaluationAccount.findUniqueOrThrow({ where: { id: evaluationId } })).version;
    const accounts = await loadAccounts(userId, ist("2026-11-06 11:00"));
    expect(accounts.map((account) => account.status)).toEqual(["ACTIVE"]);
    expect((await prisma.evaluationAccount.findUniqueOrThrow({ where: { id: evaluationId } })).version).toBe(version);
  });
});
