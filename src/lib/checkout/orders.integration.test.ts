import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { openDesk } from "@/lib/trading/desk";
import { planAmount, type Billing } from "./billing";
import { CheckoutError, completePurchase, fulfilRazorpayOrder, lastBilling, startRazorpayOrder } from "./orders";
import type { RazorpayConfig } from "./razorpay";

const localDb = (() => {
  try { const url = new URL(process.env.DATABASE_URL ?? ""); return url.hostname === "127.0.0.1" && url.pathname === "/whitesvan_preview"; }
  catch { return false; }
})();

/** These fixtures can only be created in the disposable local database. */
describe.skipIf(!localDb)("checkout purchases (PostgreSQL integration)", () => {
  const userIds: string[] = [];
  const plan = findEvaluationPlan("1l")!;
  const now = Date.UTC(2026, 9, 24, 4);
  const billing: Billing = { name: "Checkout integration", phone: "+919876543210", state: "Telangana" };
  const razorpay: RazorpayConfig = { keyId: "rzp_test_key", keySecret: "key-secret", webhookSecret: null, apiRoot: "https://razorpay.invalid/v1", testMode: true };
  /** Razorpay's order API, answering with a fresh order id for whatever amount was asked. */
  const razorpayApi = (async (_url: string, init?: RequestInit) => Response.json({ id: `order_${randomUUID().replace(/-/g, "").slice(0, 14)}`, amount: JSON.parse(String(init?.body)).amount, currency: "INR", status: "created" })) as unknown as typeof fetch;

  async function makeUser() {
    const user = await prisma.user.create({ data: { email: `checkout-${randomUUID()}@example.test`, role: "TRADER" } });
    userIds.push(user.id);
    return user;
  }
  function request(user: { id: string; email: string | null }, mode: "test" | "free" = "free", attemptId = randomUUID()) {
    return { mode, userId: user.id, email: user.email!, plan, billing, now, attemptId };
  }
  async function seedActive(userId: string, count: number) {
    for (let index = 0; index < count; index++) {
      const id = `fixture-${randomUUID()}`;
      await prisma.evaluationAccount.create({ data: { id, userId, planId: plan.id, desk: openDesk(plan, id, now) as unknown as Prisma.InputJsonValue } });
    }
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it.each(["test", "free"] as const)("opens an evaluation for every %s purchase, however many accounts the trader holds", async (mode) => {
    const user = await makeUser();
    await seedActive(user.id, 6);
    const results = await Promise.all(Array.from({ length: 4 }, () => completePurchase(request(user, mode))));
    expect(new Set(results.map((result) => result.accountId)).size).toBe(4);
    expect(await prisma.evaluationAccount.count({ where: { userId: user.id, status: "ACTIVE" } })).toBe(10);
    expect(await prisma.checkoutOrder.count({ where: { userId: user.id } })).toBe(4);
  });

  it.each(["test", "free"] as const)("deduplicates concurrent and later retries of one %s checkout attempt", async (mode) => {
    const user = await makeUser();
    const input = request(user, mode);
    const results = await Promise.all(Array.from({ length: 4 }, () => completePurchase(input)));
    expect(results.every(result => result.orderId === results[0].orderId && result.accountId === results[0].accountId)).toBe(true);
    expect(await completePurchase(input)).toEqual(results[0]);
    expect(await prisma.checkoutOrder.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.evaluationAccount.count({ where: { userId: user.id } })).toBe(1);
    const account = await prisma.evaluationAccount.findUniqueOrThrow({ where: { id: results[0].accountId } });
    expect(account.phase).toBe("EVALUATION");
    const order = await prisma.checkoutOrder.findUniqueOrThrow({ where: { id: results[0].orderId } });
    // A free start records nothing charged; a test purchase records the price it didn't charge.
    expect({ provider: order.provider, amount: order.amount, status: order.status }).toEqual({ provider: mode, amount: mode === "free" ? 0 : planAmount(plan), status: "PAID" });
  });

  it("records a free start without billing details, and fills a paid checkout from the last paid order", async () => {
    const user = await makeUser();
    const free = await completePurchase({ ...request(user), billing: { name: null, phone: null, state: null } });
    const order = await prisma.checkoutOrder.findUniqueOrThrow({ where: { id: free.orderId } });
    expect({ name: order.billingName, phone: order.billingPhone, state: order.billingState, email: order.billingEmail }).toEqual({ name: null, phone: null, state: null, email: user.email });
    expect(await lastBilling(user.id)).toBeNull();
    await completePurchase(request(user, "test"));
    await completePurchase({ ...request(user, "test"), billing: { name: null, phone: null, state: null } });
    expect(await lastBilling(user.id)).toEqual({ phone: "+919876543210", state: "Telangana" });
  });

  it("allows different attempt keys to represent intentional separate purchases", async () => {
    const user = await makeUser();
    const first = await completePurchase(request(user));
    const second = await completePurchase(request(user));
    expect(first.orderId).not.toBe(second.orderId);
    expect(await prisma.checkoutOrder.count({ where: { userId: user.id } })).toBe(2);
  });

  it("scopes attempt keys to the authenticated owner", async () => {
    const firstUser = await makeUser();
    const secondUser = await makeUser();
    const key = randomUUID();
    const first = await completePurchase(request(firstUser, "free", key));
    const second = await completePurchase(request(secondUser, "free", key));
    expect(first.orderId).not.toBe(second.orderId);
  });

  it("reuses one Razorpay order for concurrent and later retries of a stable checkout attempt", async () => {
    const user = await makeUser();
    const input = { config: razorpay, userId: user.id, email: user.email!, plan, billing, now, attemptId: randomUUID() };
    let calls = 0;
    const api = (async (_url: string, init?: RequestInit) => {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 30));
      return Response.json({ id: "order_IDEMPOTENT123", amount: JSON.parse(String(init?.body)).amount, currency: "INR", status: "created" });
    }) as unknown as typeof fetch;
    const simultaneous = await Promise.allSettled([startRazorpayOrder(input, api), startRazorpayOrder(input, api), startRazorpayOrder(input, api)]);
    expect(simultaneous.filter(result => result.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    expect(calls).toBe(1);
    expect(await prisma.checkoutOrder.count({ where: { userId: user.id } })).toBe(1);
    const original = simultaneous.find(result => result.status === "fulfilled")!;
    if (original.status !== "fulfilled") throw new Error("No original order");
    expect(await startRazorpayOrder(input, api)).toEqual(original.value);
    expect(calls).toBe(1);
  });

  it("holds a Razorpay order as pending, then opens one account however many confirmations arrive", async () => {
    const user = await makeUser();
    const started = await startRazorpayOrder({ config: razorpay, attemptId: randomUUID(), userId: user.id, email: user.email!, plan, billing, now }, razorpayApi);
    const pending = await prisma.checkoutOrder.findUniqueOrThrow({ where: { id: started.orderId } });
    expect(pending).toMatchObject({ status: "PENDING", provider: "razorpay-test", amount: planAmount(plan), providerOrderId: started.razorpayOrderId, accountId: null, paidAt: null });
    expect(await prisma.evaluationAccount.count({ where: { userId: user.id } })).toBe(0);

    // The browser's handler and the webhook, at once and again later.
    const confirm = () => fulfilRazorpayOrder({ razorpayOrderId: started.razorpayOrderId, paymentId: "pay_INTEGRATION1", now, amount: planAmount(plan) });
    const results = await Promise.all([confirm(), confirm(), confirm()]);
    expect(results.filter(result => result?.opened)).toHaveLength(1);
    expect(new Set(results.map(result => result?.accountId)).size).toBe(1);
    expect((await confirm())?.opened).toBe(false);
    expect(await prisma.evaluationAccount.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.checkoutOrder.findUniqueOrThrow({ where: { id: started.orderId } })).toMatchObject({ status: "PAID", providerPaymentId: "pay_INTEGRATION1", accountId: results[0]!.accountId });
  });

  it("refuses a payment for another amount, and orders it doesn't know", async () => {
    const user = await makeUser();
    const started = await startRazorpayOrder({ config: razorpay, attemptId: randomUUID(), userId: user.id, email: user.email!, plan, billing, now }, razorpayApi);
    await expect(fulfilRazorpayOrder({ razorpayOrderId: started.razorpayOrderId, paymentId: "pay_INTEGRATION2", now, amount: 100 })).rejects.toBeInstanceOf(CheckoutError);
    expect(await prisma.checkoutOrder.findUniqueOrThrow({ where: { id: started.orderId } })).toMatchObject({ status: "PENDING", accountId: null });
    expect(await fulfilRazorpayOrder({ razorpayOrderId: "order_UNKNOWN0000", paymentId: "pay_INTEGRATION3", now })).toBeNull();
  });

  it("takes a Razorpay payment however many accounts the trader holds", async () => {
    const user = await makeUser();
    await seedActive(user.id, 6);
    const started = await startRazorpayOrder({ config: razorpay, attemptId: randomUUID(), userId: user.id, email: user.email!, plan, billing, now }, razorpayApi);
    expect((await fulfilRazorpayOrder({ razorpayOrderId: started.razorpayOrderId, paymentId: "pay_INTEGRATION4", now }))?.opened).toBe(true);
    expect(await prisma.evaluationAccount.count({ where: { userId: user.id, status: "ACTIVE" } })).toBe(7);
  });

  it("marks the order failed when Razorpay won't create it", async () => {
    const user = await makeUser();
    const down = (async () => Response.json({ error: { description: "Server error" } }, { status: 500 })) as unknown as typeof fetch;
    await expect(startRazorpayOrder({ config: razorpay, attemptId: randomUUID(), userId: user.id, email: user.email!, plan, billing, now }, down)).rejects.toThrow("Razorpay refused the order");
    expect(await prisma.checkoutOrder.findFirstOrThrow({ where: { userId: user.id } })).toMatchObject({ status: "FAILED", providerOrderId: null });
  });
});
