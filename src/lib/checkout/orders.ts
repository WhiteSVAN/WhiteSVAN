/**
 * Turning a checkout into an evaluation account (server only). Every paid order opens one account
 * on the plan's current rulebook, which the account keeps for life (RULE-1).
 */
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { EvaluationPlan } from "@/lib/prop-firm";
import { openDesk } from "@/lib/trading/desk";
import { MAX_ACTIVE_ACCOUNTS, planAmount, type Billing } from "./billing";

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export async function activeAccountCount(userId: string): Promise<number> {
  return prisma.evaluationAccount.count({ where: { userId, status: "ACTIVE" } });
}

/**
 * A staff test purchase: records a paid order with provider "test" (no charge) and opens the
 * account, in one transaction.
 */
export async function completeTestPurchase(input: { userId: string; email: string; plan: EvaluationPlan; billing: Billing; now: number }): Promise<{ orderId: string; accountId: string }> {
  const { userId, email, plan, billing, now } = input;
  return prisma.$transaction(async (tx) => {
    const active = await tx.evaluationAccount.count({ where: { userId, status: "ACTIVE" } });
    if (active >= MAX_ACTIVE_ACCOUNTS) throw new CheckoutError(`You can hold up to ${MAX_ACTIVE_ACCOUNTS} active evaluation accounts at a time.`);
    const accountId = `ev${now.toString(36)}${randomBytes(6).toString("hex")}`;
    const desk = openDesk(plan, accountId, now);
    await tx.evaluationAccount.create({ data: { id: accountId, userId, planId: plan.id, desk: desk as unknown as Prisma.InputJsonValue } });
    const order = await tx.checkoutOrder.create({
      data: {
        userId,
        planId: plan.id,
        amount: planAmount(plan),
        status: "PAID",
        provider: "test",
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
