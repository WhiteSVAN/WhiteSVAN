"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { tradingNow } from "@/lib/accounts/clock";
import { accountNumber, billingSchema } from "@/lib/checkout/billing";
import { checkoutModeFor } from "@/lib/checkout/config";
import { CheckoutError, completeTestPurchase } from "@/lib/checkout/orders";
import { sendOrderConfirmation } from "@/lib/email";
import { logger } from "@/lib/logger";
import { findEvaluationPlan } from "@/lib/prop-firm";

export interface CheckoutState {
  errors?: Partial<Record<"name" | "phone" | "state" | "terms", string[]>>;
  message?: string;
}

/** Check out one evaluation. Until a payment gateway is live, only staff test purchases complete. */
export async function checkout(planId: string, _previous: CheckoutState | undefined, formData: FormData): Promise<CheckoutState | undefined> {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/login?${new URLSearchParams({ next: `/checkout/${planId}` })}`);
  const plan = findEvaluationPlan(planId);
  if (!plan) return { message: "That account size isn't available." };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return { message: "Add an email address to your account to check out." };
  if (checkoutModeFor(user.email) !== "test") return { message: "Checkout opens at launch. Join the launch list and we'll email you when it does." };

  const parsed = billingSchema.safeParse({ name: formData.get("name"), phone: formData.get("phone"), state: formData.get("state"), terms: formData.get("terms") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  let order: { orderId: string; accountId: string };
  try {
    order = await completeTestPurchase({ userId, email: user.email, plan, billing: parsed.data, now: tradingNow() });
  } catch (error) {
    if (error instanceof CheckoutError) return { message: error.message };
    throw error;
  }
  logger.info("checkout.test_purchase", { userId, planId: plan.id, orderId: order.orderId, accountId: order.accountId });
  await sendOrderConfirmation(user.email, { planLabel: plan.label, accountNumber: accountNumber(order.accountId, plan.id), accountId: order.accountId }).catch((error: unknown) => {
    logger.warn("checkout.confirmation_email_failed", { orderId: order.orderId, error: error instanceof Error ? error.message : String(error) });
  });
  redirect(`/checkout/complete/${order.orderId}`);
}
