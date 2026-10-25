/**
 * Turning a checkout into a demo account, the evaluation (server only). Every completed order opens
 * one account on the plan's current rulebook, which the account keeps for life (RULE-1). Test and
 * free orders complete at once. A Razorpay order waits as PENDING until its payment is confirmed,
 * by the browser's signed handler or by the webhook, whichever arrives first.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { newAccountId } from "@/lib/accounts/store";
import { findAccountPlan, type EvaluationPlan } from "@/lib/prop-firm";
import { openDesk } from "@/lib/trading/desk";
import { MAX_ACTIVE_ACCOUNTS, planAmount, type Billing } from "./billing";
import { checkoutAttemptKey, isCheckoutAttemptId } from "./attempt";
import { createRazorpayOrder, razorpayProvider, type RazorpayConfig } from "./razorpay";

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

type Tx = Prisma.TransactionClient;

export async function activeAccountCount(userId: string): Promise<number> {
  return prisma.evaluationAccount.count({ where: { userId, status: "ACTIVE" } });
}

/** The details from the user's last order, to fill in their next checkout. */
export async function lastBilling(userId: string): Promise<{ name: string; phone: string | null; state: string } | null> {
  const order = await prisma.checkoutOrder.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { billingName: true, billingPhone: true, billingState: true } });
  return order && { name: order.billingName, phone: order.billingPhone, state: order.billingState };
}

/** Lock the user before counting accounts, so purchases at once can't both slip under the limit. */
async function lockUser(tx: Tx, userId: string): Promise<void> {
  const owners = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  if (!owners.length) throw new CheckoutError("Sign in again to complete checkout.");
}

async function checkLimit(tx: Tx, userId: string): Promise<void> {
  const active = await tx.evaluationAccount.count({ where: { userId, status: "ACTIVE" } });
  if (active >= MAX_ACTIVE_ACCOUNTS) throw new CheckoutError(`You can hold up to ${MAX_ACTIVE_ACCOUNTS} active accounts at a time.`);
}

async function openEvaluation(tx: Tx, userId: string, plan: EvaluationPlan, now: number): Promise<string> {
  const accountId = newAccountId(now);
  await tx.evaluationAccount.create({ data: { id: accountId, userId, planId: plan.id, desk: openDesk(plan, accountId, now) as unknown as Prisma.InputJsonValue } });
  return accountId;
}

const billingData = (userId: string, email: string, plan: EvaluationPlan, billing: Billing, now: number) => ({
  userId,
  planId: plan.id,
  billingName: billing.name,
  billingEmail: email,
  billingPhone: billing.phone,
  billingState: billing.state,
  acceptedTermsAt: new Date(now),
});

/**
 * A purchase that completes at once, in one transaction: a staff test purchase (provider "test":
 * the plan's price recorded, nothing charged) or, while payments aren't switched on, a free start
 * (provider "free", amount 0). Submitting the same checkout attempt again returns the same order.
 */
export async function completePurchase(input: { mode: "test" | "free"; userId: string; email: string; plan: EvaluationPlan; billing: Billing; now: number; attemptId: string }): Promise<{ orderId: string; accountId: string }> {
  const { mode, userId, email, plan, billing, now, attemptId } = input;
  if (!isCheckoutAttemptId(attemptId)) throw new CheckoutError("Refresh checkout and try again.");
  const providerOrderId = checkoutAttemptKey(userId, mode, attemptId);
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const existing = await tx.checkoutOrder.findUnique({ where: { providerOrderId }, select: { id: true, userId: true, planId: true, status: true, accountId: true } });
    if (existing) {
      if (existing.userId !== userId || existing.planId !== plan.id || existing.status !== "PAID" || !existing.accountId) {
        throw new CheckoutError("This checkout attempt has already been used. Refresh checkout and try again.");
      }
      return { orderId: existing.id, accountId: existing.accountId };
    }
    await checkLimit(tx, userId);
    const accountId = await openEvaluation(tx, userId, plan, now);
    const order = await tx.checkoutOrder.create({
      data: { ...billingData(userId, email, plan, billing, now), amount: mode === "free" ? 0 : planAmount(plan), status: "PAID", provider: mode, providerOrderId, accountId, paidAt: new Date(now) },
      select: { id: true },
    });
    return { orderId: order.id, accountId };
  });
}

/**
 * A Razorpay order for the plan's fee: our order row (PENDING) and Razorpay's order for it, which
 * the browser opens Checkout.js on. The account limit is checked here, before any money is taken;
 * the account itself opens when the payment is confirmed (`fulfilRazorpayOrder`).
 */
export async function startRazorpayOrder(input: { config: RazorpayConfig; userId: string; email: string; plan: EvaluationPlan; billing: Billing; now: number }, fetchImpl?: typeof fetch): Promise<{ orderId: string; razorpayOrderId: string; amount: number }> {
  const { config, userId, email, plan, billing, now } = input;
  const amount = planAmount(plan);
  const order = await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await checkLimit(tx, userId);
    return tx.checkoutOrder.create({ data: { ...billingData(userId, email, plan, billing, now), amount, status: "PENDING", provider: razorpayProvider(config) }, select: { id: true } });
  });
  try {
    const razorpay = await createRazorpayOrder(config, { amount, receipt: order.id, notes: { order: order.id, plan: plan.id } }, fetchImpl);
    await prisma.checkoutOrder.update({ where: { id: order.id }, data: { providerOrderId: razorpay.id } });
    return { orderId: order.id, razorpayOrderId: razorpay.id, amount };
  } catch (error) {
    await prisma.checkoutOrder.update({ where: { id: order.id }, data: { status: "FAILED" } });
    throw error;
  }
}

export interface FulfilledOrder {
  orderId: string;
  accountId: string;
  userId: string;
  planId: string;
  email: string;
  amount: number;
  /** "razorpay", or "razorpay-test" for an order paid in Razorpay's test mode. */
  provider: string;
  /** False when an earlier confirmation already opened the account. */
  opened: boolean;
}

/**
 * Open the account for a paid Razorpay order, once. The browser's handler and the webhook can both
 * arrive, in either order: the order row is locked, so the first opens the account and the second
 * gets the same answer. A paid order opens its account even if the trader has since reached the
 * account limit. Null when no open order matches.
 */
export async function fulfilRazorpayOrder(input: { razorpayOrderId: string; paymentId: string; now: number; amount?: number }): Promise<FulfilledOrder | null> {
  const { razorpayOrderId, paymentId, now } = input;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "CheckoutOrder" WHERE "providerOrderId" = ${razorpayOrderId} AND "provider" IN ('razorpay', 'razorpay-test') FOR UPDATE`;
    if (!rows.length) return null;
    const order = await tx.checkoutOrder.findUniqueOrThrow({ where: { id: rows[0].id }, select: { id: true, userId: true, planId: true, amount: true, provider: true, status: true, accountId: true, billingEmail: true } });
    const result = (accountId: string, opened: boolean): FulfilledOrder => ({ orderId: order.id, accountId, userId: order.userId, planId: order.planId, email: order.billingEmail, amount: order.amount, provider: order.provider, opened });
    if (order.status === "PAID" && order.accountId) return result(order.accountId, false);
    if (order.status !== "PENDING") return null;
    if (input.amount !== undefined && input.amount !== order.amount) throw new CheckoutError("The payment doesn't match the order amount.");
    const plan = findAccountPlan(order.planId);
    if (!plan) throw new CheckoutError(`No plan "${order.planId}" for this order.`);
    const accountId = await openEvaluation(tx, order.userId, plan, now);
    await tx.checkoutOrder.update({ where: { id: order.id }, data: { status: "PAID", providerPaymentId: paymentId, paidAt: new Date(now), accountId } });
    return result(accountId, true);
  });
}
