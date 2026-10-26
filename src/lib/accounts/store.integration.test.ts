import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findEvaluationPlan, PROGRAMME_RULES } from "@/lib/prop-firm";
import { deskStep, openDesk, type Desk } from "@/lib/trading/desk";
import type { EngineEvent } from "@/lib/trading/engine";
import type { Instrument } from "@/lib/trading/instruments";
import type { Quote } from "@/lib/trading/matching";
import { ist } from "@/lib/trading/time";
import { contractInstrument, type MarketQuote } from "@/lib/zerodha/kite";
import { applyOrder, orderPolicyProblem } from "./ticks";
import { activateFundedAccount, changeAccount, changeAccountForOrder, loadAccounts, waitingPasses } from "./store";

const localDb = (() => {
  try { const url = new URL(process.env.DATABASE_URL ?? ""); return url.hostname === "127.0.0.1" && url.pathname === "/whitesvan_preview"; }
  catch { return false; }
})();

// Test fixtures, not exchange values.
const r = (rupees: number) => Math.round(rupees * 100);
const CALL: Instrument = { token: 401, exchange: "NFO", tradingSymbol: "NIFTY-25000-CE-STORE", underlying: "NIFTY", kind: "CE", expiry: "2026-11-24", strike: r(25_000), lotSize: 75, tickSize: 5, freezeQuantity: 1_800 };
const PUT: Instrument = { ...CALL, token: 402, tradingSymbol: "NIFTY-25000-PE-STORE", kind: "PE" };
const DAYS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];
const plan = findEvaluationPlan("1l")!;

function orderQuote(instrument: Instrument): MarketQuote {
  const at = ist("2026-11-02 10:00");
  return { key: `${instrument.exchange}:${instrument.tradingSymbol}`, token: instrument.token, at, lastTradeAt: at, lastPrice: r(120), previousClose: r(120), open: r(120), high: r(120), low: r(120), volume: 1_000, oi: 10_000, bids: [{ price: r(119), quantity: 5_000, orders: 1 }], asks: [{ price: r(121), quantity: 5_000, orders: 1 }] };
}

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

  /** Open funded accounts for the trader, as earlier passes would have. */
  async function seedFunded(userId: string, count: number): Promise<string[]> {
    const ids = Array.from({ length: count }, () => `ev-funded-${randomUUID()}`);
    await prisma.evaluationAccount.createMany({ data: ids.map((id) => ({ id, userId, planId: plan.id, phase: "FUNDED" as const, desk: openDesk(plan, id, ist("2026-10-01 09:00"), "FUNDED") as unknown as Prisma.InputJsonValue })) });
    return ids;
  }

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

  it("holds a pass while the most funded accounts are open, and activates it once one ends", async () => {
    const { userId, evaluationId } = await traderWithPassingDay();
    const funded = await seedFunded(userId, PROGRAMME_RULES.maximumFundedAccounts);

    const accounts = await loadAccounts(userId, ist("2026-11-09 09:00"));
    expect(accounts.find((account) => account.id === evaluationId)).toMatchObject({ status: "PASSED" });
    expect(await prisma.evaluationAccount.count({ where: { fromAccountId: evaluationId } })).toBe(0);
    expect([...waitingPasses(accounts)]).toEqual([evaluationId]);
    expect(await activateFundedAccount(userId, evaluationId, ist("2026-11-09 10:00"))).toBe("full");

    // One funded account ends: the pass can take its place, once, however often it's pressed.
    await prisma.evaluationAccount.update({ where: { id: funded[0] }, data: { status: "FAILED" } });
    const results = await Promise.all([1, 2, 3].map(() => activateFundedAccount(userId, evaluationId, ist("2026-11-09 10:00"))));
    const opened = await prisma.evaluationAccount.findMany({ where: { fromAccountId: evaluationId } });
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ userId, phase: "FUNDED", status: "ACTIVE", planId: plan.id });
    expect(results).toEqual([1, 2, 3].map(() => ({ fundedId: opened[0].id })));
    expect(waitingPasses(await loadAccounts(userId, ist("2026-11-09 10:00"))).size).toBe(0);
  });

  it("gives the last funded place to one of two passes at once; the other waits", async () => {
    const user = await prisma.user.create({ data: { email: `store-${randomUUID()}@example.test`, role: "TRADER" } });
    userIds.push(user.id);
    await seedFunded(user.id, PROGRAMME_RULES.maximumFundedAccounts - 1);
    const ids = [`ev-store-${randomUUID()}`, `ev-store-${randomUUID()}`];
    await prisma.evaluationAccount.createMany({ data: ids.map((id) => ({ id, userId: user.id, planId: plan.id, desk: passingDesk(id) as unknown as Prisma.InputJsonValue })) });
    const close = (desk: Desk) => ({ desk: deskStep(desk, { kind: "clock", at: ist("2026-11-06 15:35") }, new Map()).desk, result: null });
    await Promise.all(ids.map((id) => changeAccount(user.id, id, close)));

    expect(await prisma.evaluationAccount.count({ where: { userId: user.id, phase: "EVALUATION", status: "PASSED" } })).toBe(2);
    expect(await prisma.evaluationAccount.count({ where: { userId: user.id, phase: "FUNDED", status: "ACTIVE" } })).toBe(PROGRAMME_RULES.maximumFundedAccounts);
    expect(waitingPasses(await loadAccounts(user.id, ist("2026-11-09 09:00"))).size).toBe(1);
  });

  it("activates only the trader's own passed evaluations", async () => {
    const { userId, evaluationId } = await traderWithPassingDay();
    expect(await activateFundedAccount(userId, evaluationId, ist("2026-11-06 11:00"))).toBeNull();
    const stranger = await prisma.user.create({ data: { email: `store-${randomUUID()}@example.test`, role: "TRADER" } });
    userIds.push(stranger.id);
    await loadAccounts(userId, ist("2026-11-09 09:00"));
    expect(await activateFundedAccount(stranger.id, evaluationId, ist("2026-11-09 10:00"))).toBeNull();
  });

  it("leaves a day still trading alone", async () => {
    const { userId, evaluationId } = await traderWithPassingDay();
    const version = (await prisma.evaluationAccount.findUniqueOrThrow({ where: { id: evaluationId } })).version;
    const accounts = await loadAccounts(userId, ist("2026-11-06 11:00"));
    expect(accounts.map((account) => account.status)).toEqual(["ACTIVE"]);
    expect((await prisma.evaluationAccount.findUniqueOrThrow({ where: { id: evaluationId } })).version).toBe(version);
  });

  async function oppositeBuy(userId: string, id: string, instrument: Instrument, orderId: string) {
    return changeAccountForOrder(userId, id, (account, active) => {
      const problem = orderPolicyProblem(account.desk, instrument, "BUY", 1, active.map((item) => item.desk));
      if (problem) throw new Error(problem);
      const result = applyOrder(account.desk, contractInstrument(instrument), { id: orderId, token: instrument.token, side: "BUY", lots: 1, type: "MARKET" }, [orderQuote(instrument)], ist("2026-11-02 10:00"));
      return { desk: result.desk, result: result.outputs };
    });
  }

  it("serializes opposite call and put buys on the same account", async () => {
    const user = await prisma.user.create({ data: { email: `store-${randomUUID()}@example.test`, role: "TRADER" } });
    userIds.push(user.id);
    const userId = user.id;
    const id = `ev-store-${randomUUID()}`;
    await prisma.evaluationAccount.create({ data: { id, userId, planId: plan.id, desk: openDesk(plan, id, ist("2026-11-02 09:00")) as unknown as Prisma.InputJsonValue } });

    const results = await Promise.allSettled([
      oppositeBuy(userId, id, CALL, `same-call-${randomUUID()}`),
      oppositeBuy(userId, id, PUT, `same-put-${randomUUID()}`),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected").map((result) => (result as PromiseRejectedResult).reason.message)).toEqual([
      expect.stringContaining("Directional bets only"),
    ]);
    expect((await prisma.evaluationAccount.findUniqueOrThrow({ where: { id } })).desk).toMatchObject({ state: { positions: [{ instrument: { token: expect.any(Number) } }] } });
  });

  it("serializes opposite call and put buys across the trader's accounts", async () => {
    const user = await prisma.user.create({ data: { email: `store-${randomUUID()}@example.test`, role: "TRADER" } });
    userIds.push(user.id);
    const userId = user.id;
    const ids = [`ev-store-${randomUUID()}`, `ev-store-${randomUUID()}`];
    await prisma.evaluationAccount.createMany({ data: ids.map((id) => ({ id, userId, planId: plan.id, desk: openDesk(plan, id, ist("2026-11-02 09:00")) as unknown as Prisma.InputJsonValue })) });

    const results = await Promise.allSettled([
      oppositeBuy(userId, ids[0], CALL, `cross-call-${randomUUID()}`),
      oppositeBuy(userId, ids[1], PUT, `cross-put-${randomUUID()}`),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected").map((result) => (result as PromiseRejectedResult).reason.message)).toEqual([
      expect.stringContaining("No hedging across accounts"),
    ]);
    expect(await prisma.evaluationAccount.count({ where: { userId, version: 1 } })).toBe(1);
  });
});
