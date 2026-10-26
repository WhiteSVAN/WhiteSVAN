"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { tradingNow } from "@/lib/accounts/clock";
import { requireMember } from "@/lib/auth/dal";
import { joinWithPassword } from "@/lib/auth/join";
import { billingSchema, openedPath, type Billing } from "@/lib/checkout/billing";
import { isCheckoutAttemptId } from "@/lib/checkout/attempt";
import { checkoutModeFor } from "@/lib/checkout/config";
import { CheckoutError, completePurchase, fulfilRazorpayOrder, startRazorpayOrder } from "@/lib/checkout/orders";
import { fetchRazorpayPayment, paymentSignatureValid, RAZORPAY_PROVIDERS, razorpayConfig, type RazorpayPayment } from "@/lib/checkout/razorpay";
import { sendReceipt } from "@/lib/checkout/receipt";
import { logger } from "@/lib/logger";
import { findEvaluationPlan, RECOMMENDED_PLAN } from "@/lib/prop-firm";

/** What a refused checkout hands back, so nothing has to be typed twice. The password never is. */
export interface CheckoutValues {
  email: string;
  phone: string;
  state: string;
}

/** A Razorpay order for the browser to open Checkout.js on. */
export interface PaymentRequest {
  orderId: string;
  razorpayOrderId: string;
  keyId: string;
  /** Paise. */
  amount: number;
  description: string;
  prefill: { name: string; email: string; contact: string };
}

export interface CheckoutState {
  errors?: Partial<Record<"email" | "password" | "phone" | "state", string[]>>;
  message?: string;
  values?: CheckoutValues;
  payment?: PaymentRequest;
  /** Set once this checkout has created the account or signed in to it: the form is signed in from then on. */
  account?: { email: string };
}

/**
 * Check out one evaluation, on the size chosen in the form, in one submission. Signed out, the
 * form carries an email and a password: the account is created (or signed in to) first. With
 * Razorpay on, this creates the order and hands it to the browser to pay; the account opens in
 * `confirmPayment` (or the webhook). Otherwise the account opens here: a staff test purchase, or
 * a free start while payments aren't switched on. Pressing the button accepts the rules.
 */
export async function checkout(_previous: CheckoutState | undefined, formData: FormData): Promise<CheckoutState | undefined> {
  const plan = findEvaluationPlan(String(formData.get("plan") ?? ""));
  const values: CheckoutValues = { email: String(formData.get("email") ?? ""), phone: String(formData.get("phone") ?? ""), state: String(formData.get("state") ?? "") };
  let userId = (await auth())?.user?.id;
  // A form shown signed in has no account fields: its session has expired, so sign in again.
  if (!userId && !formData.has("email")) redirect(`/login?${new URLSearchParams({ next: `/checkout/${plan?.id ?? RECOMMENDED_PLAN.id}` })}`);
  if (!plan) return { message: "Choose an account size.", values };
  const attemptId = formData.get("attempt");
  if (!isCheckoutAttemptId(attemptId)) return { message: "Refresh checkout and try again.", values };

  let account: CheckoutState["account"];
  if (userId) {
    await requireMember();
  } else {
    const joined = await joinWithPassword({ email: formData.get("email"), password: formData.get("password"), referral: String(formData.get("ref") ?? "") });
    if (!joined.joined) return { errors: joined.errors, message: joined.message, values };
    userId = joined.userId;
    account = { email: joined.email };
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user?.email) return { message: "Add an email address to your account to check out.", values, account };
  const mode = checkoutModeFor(user.email);
  const now = tradingNow();

  if (mode === "razorpay") {
    const parsed = billingSchema.safeParse({ phone: formData.get("phone"), state: formData.get("state") });
    if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values, account };
    const billing: Billing = { name: user.name, ...parsed.data };
    const config = razorpayConfig();
    if (!config) return { message: "Payments are unavailable right now. Try again in a minute.", values, account };
    let started: Awaited<ReturnType<typeof startRazorpayOrder>>;
    try {
      started = await startRazorpayOrder({ config, userId, email: user.email, plan, billing, now, attemptId });
    } catch (error) {
      if (error instanceof CheckoutError) return { message: error.message, values, account };
      logger.error("checkout.razorpay_order_failed", { userId, planId: plan.id, error: error instanceof Error ? error.message : String(error) });
      return { message: "Payments are unavailable right now. Try again in a minute.", values, account };
    }
    if (started.accountId) redirect(openedPath(started.accountId, started.orderId));
    logger.info("checkout.razorpay_order", { userId, planId: plan.id, orderId: started.orderId });
    return {
      values,
      account,
      payment: { ...started, keyId: config.keyId, description: `${plan.label} evaluation`, prefill: { name: user.name ?? "", email: user.email, contact: parsed.data.phone } },
    };
  }

  let order: { orderId: string; accountId: string };
  try {
    order = await completePurchase({ mode, userId, email: user.email, plan, billing: { name: user.name, phone: null, state: null }, now, attemptId });
  } catch (error) {
    if (error instanceof CheckoutError) return { message: error.message, values, account };
    throw error;
  }
  logger.info(`checkout.${mode}_purchase`, { userId, planId: plan.id, orderId: order.orderId, accountId: order.accountId });
  await sendReceipt(user.email, { ...order, planId: plan.id }, { kind: mode });
  redirect(openedPath(order.accountId, order.orderId));
}

/**
 * Razorpay Checkout's success handler, from the browser: the signature is checked against the
 * Razorpay order we stored (never the one the browser sends), then the API must confirm the
 * captured amount and currency before the account opens, once.
 */
export async function confirmPayment(input: { orderId: string; paymentId: string; signature: string }): Promise<{ message: string } | undefined> {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/login?${new URLSearchParams({ next: "/dashboard" })}`);
  const { orderId, paymentId, signature }: Partial<typeof input> = input ?? {};
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string" || !/^pay_\w{6,40}$/.test(paymentId)) {
    return { message: "We couldn't read the payment. If you were charged, your account opens as soon as Razorpay confirms it: check My accounts in a few minutes." };
  }
  const pending = `If you were charged, your account opens as soon as Razorpay confirms the payment (payment ${paymentId}). Check My accounts in a few minutes.`;
  const config = razorpayConfig();
  const order = await prisma.checkoutOrder.findFirst({ where: { id: orderId, userId, provider: { in: [...RAZORPAY_PROVIDERS] } }, select: { providerOrderId: true, amount: true } });
  if (!config || !order?.providerOrderId) return { message: `We couldn't confirm the payment here. ${pending}` };
  if (!paymentSignatureValid(config.keySecret, order.providerOrderId, paymentId, signature)) {
    logger.warn("checkout.razorpay_signature_mismatch", { userId, orderId });
    return { message: `We couldn't verify the payment. ${pending}` };
  }
  let payment: RazorpayPayment;
  try {
    payment = await fetchRazorpayPayment(config, paymentId);
  } catch (error) {
    logger.warn("checkout.razorpay_verification_unavailable", { userId, orderId, paymentId, error: error instanceof Error ? error.message : String(error) });
    return { message: `We couldn't confirm the payment right now. ${pending}` };
  }
  if (payment.order_id !== order.providerOrderId || payment.amount !== order.amount || payment.currency !== "INR") {
    logger.error("checkout.razorpay_payment_mismatch", { userId, orderId, paymentId });
    return { message: `We couldn't verify the payment details. ${pending}` };
  }
  if (payment.status !== "captured" || !payment.captured) {
    return { message: `Your payment is awaiting confirmation. ${pending}` };
  }
  const fulfilled = await fulfilRazorpayOrder({ razorpayOrderId: order.providerOrderId, paymentId, amount: payment.amount, now: tradingNow() });
  if (!fulfilled) return { message: `This order is closed. ${pending}` };
  if (fulfilled.opened) {
    logger.info("checkout.razorpay_paid", { userId, orderId: fulfilled.orderId, accountId: fulfilled.accountId, via: "handler" });
    await sendReceipt(fulfilled.email, fulfilled, { kind: "paid", amount: fulfilled.amount, paymentId, test: fulfilled.provider === "razorpay-test" });
  }
  redirect(openedPath(fulfilled.accountId, fulfilled.orderId));
}
