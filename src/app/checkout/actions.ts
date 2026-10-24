"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { tradingNow } from "@/lib/accounts/clock";
import { requireMember } from "@/lib/auth/dal";
import { accountNumber, billingSchema } from "@/lib/checkout/billing";
import { isCheckoutAttemptId } from "@/lib/checkout/attempt";
import { checkoutModeFor } from "@/lib/checkout/config";
import { CheckoutError, completePurchase } from "@/lib/checkout/orders";
import { sendOrderConfirmation } from "@/lib/email";
import { logger } from "@/lib/logger";
import { findEvaluationPlan } from "@/lib/prop-firm";

export interface CheckoutValues {
  name: string;
  phone: string;
  state: string;
  terms: boolean;
}

export interface CheckoutState {
  errors?: Partial<Record<"name" | "phone" | "state" | "terms", string[]>>;
  message?: string;
  /** What was submitted, so a refused checkout keeps the trader's details. */
  values?: CheckoutValues;
}

/**
 * Check out one evaluation, on the size chosen in the form. Until a payment gateway is live: staff
 * test purchases, or demo purchases on virtual credit.
 */
export async function checkout(_previous: CheckoutState | undefined, formData: FormData): Promise<CheckoutState | undefined> {
  const plan = findEvaluationPlan(String(formData.get("plan") ?? ""));
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/login?${new URLSearchParams({ next: plan ? `/checkout/${plan.id}` : "/checkout" })}`);
  await requireMember();
  const values: CheckoutValues = { name: String(formData.get("name") ?? ""), phone: String(formData.get("phone") ?? ""), state: String(formData.get("state") ?? ""), terms: formData.get("terms") === "on" };
  if (!plan) return { message: "Choose an account size.", values };
  const attemptId = formData.get("attempt");
  if (!isCheckoutAttemptId(attemptId)) return { message: "Refresh checkout and try again.", values };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return { message: "Add an email address to your account to check out.", values };
  const mode = checkoutModeFor(user.email);
  if (mode === "closed") return { message: "Checkout opens at launch. Join the launch list and we'll email you when it does.", values };

  const parsed = billingSchema.safeParse({ name: formData.get("name"), phone: formData.get("phone"), state: formData.get("state"), terms: formData.get("terms") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

  let order: { orderId: string; accountId: string };
  try {
    order = await completePurchase({ mode, userId, email: user.email, plan, billing: parsed.data, now: tradingNow(), attemptId });
  } catch (error) {
    if (error instanceof CheckoutError) return { message: error.message, values };
    throw error;
  }
  logger.info(`checkout.${mode}_purchase`, { userId, planId: plan.id, orderId: order.orderId, accountId: order.accountId });
  await sendOrderConfirmation(user.email, { planLabel: plan.label, accountNumber: accountNumber(order.accountId, plan.id), accountId: order.accountId, demo: mode === "demo" }).catch((error: unknown) => {
    logger.warn("checkout.confirmation_email_failed", { orderId: order.orderId, error: error instanceof Error ? error.message : String(error) });
  });
  redirect(`/checkout/complete/${order.orderId}`);
}
