/**
 * Turning a checkout into an evaluation account (server only). Every paid order opens one account
 * on the plan's current rulebook, which the account keeps for life (RULE-1).
 */
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formatInr, type EvaluationPlan } from "@/lib/prop-firm";
import { openDesk } from "@/lib/trading/desk";
import { MAX_ACTIVE_ACCOUNTS, planAmount, type Billing } from "./billing";
import { checkoutAttemptKey, isCheckoutAttemptId } from "./attempt";
import { DEMO_CREDIT } from "./demo";

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export async function activeAccountCount(userId: string): Promise<number> {
  return prisma.evaluationAccount.count({ where: { userId, status: "ACTIVE" } });
}

/** The details from the user's last order, to fill in their next checkout. */
export async function lastBilling(userId: string): Promise<{ name: string; phone: string | null; state: string } | null> {
  const order = await prisma.checkoutOrder.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { billingName: true, billingPhone: true, billingState: true } });
  return order && { name: order.billingName, phone: order.billingPhone, state: order.billingState };
}

/**
 * A purchase without a gateway, in one transaction: a staff test purchase (provider "test", no
 * charge) or a demo purchase paid from the user's virtual demo credit (provider "demo"), which opens
 * a demo account. Either way the order is recorded at the plan's price and the account opens.
 */
export async function completePurchase(input: { mode: "test" | "demo"; userId: string; email: string; plan: EvaluationPlan; billing: Billing; now: number; attemptId: string }): Promise<{ orderId: string; accountId: string }> {
  const { mode, userId, email, plan, billing, now, attemptId } = input;
  if (!isCheckoutAttemptId(attemptId)) throw new CheckoutError("Refresh checkout and try again.");
  const providerOrderId = checkoutAttemptKey(userId, mode, attemptId);
  const amount = planAmount(plan);
  return prisma.$transaction(async (tx) => {
    // Lock before counting for BOTH modes. The later demo-credit debit cannot
    // protect a count that has already been read by another transaction.
    const owners = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    if (!owners.length) throw new CheckoutError("Sign in again to complete checkout.");
    const existing = await tx.checkoutOrder.findUnique({ where: { providerOrderId }, select: { id: true, userId: true, planId: true, status: true, accountId: true } });
    if (existing) {
      if (existing.userId !== userId || existing.planId !== plan.id || existing.status !== "PAID" || !existing.accountId) {
        throw new CheckoutError("This checkout attempt has already been used. Refresh checkout and try again.");
      }
      return { orderId: existing.id, accountId: existing.accountId };
    }
    const active = await tx.evaluationAccount.count({ where: { userId, status: "ACTIVE" } });
    if (active >= MAX_ACTIVE_ACCOUNTS) throw new CheckoutError(`You can hold up to ${MAX_ACTIVE_ACCOUNTS} active evaluation accounts at a time.`);
    if (mode === "demo") {
      // Conditional on the credit left, so two purchases at once can't overspend it.
      const paid = await tx.user.updateMany({ where: { id: userId, demoCreditSpent: { lte: DEMO_CREDIT * 100 - amount } }, data: { demoCreditSpent: { increment: amount } } });
      if (paid.count === 0) throw new CheckoutError(`Not enough demo credit left for a ${formatInr(plan.fee)} evaluation.`);
    }
    const accountId = `ev${now.toString(36)}${randomBytes(6).toString("hex")}`;
    const desk = openDesk(plan, accountId, now);
    await tx.evaluationAccount.create({ data: { id: accountId, userId, planId: plan.id, demo: mode === "demo", desk: desk as unknown as Prisma.InputJsonValue } });
    const order = await tx.checkoutOrder.create({
      data: {
        userId,
        planId: plan.id,
        amount,
        status: "PAID",
        provider: mode,
        providerOrderId,
        accountId,
        billingName: billing.name,
        billingEmail: email,
        billingPhone: billing.phone,
        billingState: billing.state,
        acceptedTermsAt: new Date(now),
        paidAt: new Date(now),
      },
      select: { id: true },
    });
    return { orderId: order.id, accountId };
  });
}
