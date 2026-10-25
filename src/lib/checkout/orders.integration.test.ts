import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { openDesk } from "@/lib/trading/desk";
import { MAX_ACTIVE_ACCOUNTS, planAmount, type Billing } from "./billing";
import { CheckoutError, completePurchase } from "./orders";

const localDb = (() => {
  try { const url = new URL(process.env.DATABASE_URL ?? ""); return url.hostname === "127.0.0.1" && url.pathname === "/whitesvan_preview"; }
  catch { return false; }
})();

/** These fixtures can only be created in the disposable local database. */
describe.skipIf(!localDb)("checkout purchases (PostgreSQL integration)", () => {
  const userIds: string[] = [];
  const plan = findEvaluationPlan("1l")!;
  const now = Date.UTC(2026, 9, 24, 4);
  const billing: Billing = { name: "Checkout integration", phone: "+919876543210", state: "Telangana", terms: "on" };

  async function makeUser() {
    const user = await prisma.user.create({ data: { email: `checkout-${randomUUID()}@example.test`, role: "TRADER" } });
    userIds.push(user.id);
    return user;
  }
  function request(user: { id: string; email: string | null }, mode: "test" | "demo" = "demo", attemptId = randomUUID()) {
    return { mode, userId: user.id, email: user.email!, plan, billing, now, attemptId };
  }
  async function seedActive(userId: string, count: number) {
    for (let index = 0; index < count; index++) {
      const id = `fixture-${randomUUID()}`;
      await prisma.evaluationAccount.create({ data: { id, userId, planId: plan.id, demo: true, desk: openDesk(plan, id, now) as unknown as Prisma.InputJsonValue } });
    }
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it.each(["test", "demo"] as const)("serializes concurrent %s purchases before checking the active-account cap", async (mode) => {
    const user = await makeUser();
    await seedActive(user.id, MAX_ACTIVE_ACCOUNTS - 1);
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => completePurchase(request(user, mode))));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) if (result.status === "rejected") {
      expect(result.reason).toBeInstanceOf(CheckoutError);
      expect(result.reason.message).toContain("active evaluation accounts");
    }
    expect(await prisma.evaluationAccount.count({ where: { userId: user.id, status: "ACTIVE" } })).toBe(MAX_ACTIVE_ACCOUNTS);
    expect(await prisma.checkoutOrder.count({ where: { userId: user.id } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).demoCreditSpent).toBe(mode === "demo" ? planAmount(plan) : 0);
  });

  it.each(["test", "demo"] as const)("deduplicates concurrent and later retries of one %s checkout attempt", async (mode) => {
    const user = await makeUser();
    const input = request(user, mode);
    const results = await Promise.all(Array.from({ length: 4 }, () => completePurchase(input)));
    expect(results.every(result => result.orderId === results[0].orderId && result.accountId === results[0].accountId)).toBe(true);
    expect(await completePurchase(input)).toEqual(results[0]);
    expect(await prisma.checkoutOrder.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.evaluationAccount.count({ where: { userId: user.id } })).toBe(1);
    const account = await prisma.evaluationAccount.findUniqueOrThrow({ where: { id: results[0].accountId } });
    expect(account.demo).toBe(mode === "demo");
    expect(account.phase).toBe("EVALUATION");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).demoCreditSpent).toBe(mode === "demo" ? planAmount(plan) : 0);
  });

  it("allows different attempt keys to represent intentional separate purchases", async () => {
    const user = await makeUser();
    const first = await completePurchase(request(user));
    const second = await completePurchase(request(user));
    expect(first.orderId).not.toBe(second.orderId);
    expect(await prisma.checkoutOrder.count({ where: { userId: user.id } })).toBe(2);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).demoCreditSpent).toBe(2 * planAmount(plan));
  });

  it("scopes attempt keys to the authenticated owner", async () => {
    const firstUser = await makeUser();
    const secondUser = await makeUser();
    const key = randomUUID();
    const first = await completePurchase(request(firstUser, "demo", key));
    const second = await completePurchase(request(secondUser, "demo", key));
    expect(first.orderId).not.toBe(second.orderId);
  });
});
