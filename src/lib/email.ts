/**
 * Outbound email.
 *
 * With RESEND_API_KEY and EMAIL_FROM set (a sender on a domain verified in Resend), `sendEmail`
 * delivers through Resend's API. Without them it logs the message to the server console, which
 * drives the password-reset flow in development (read the link from your `next dev` terminal).
 *
 * Server-only by construction: only imported from Server Actions, so the reset
 * token is never returned to the browser — a forgot-password request can't be
 * used to enumerate accounts or steal tokens.
 */
import { accountNumber } from "@/lib/checkout/billing";
import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/site";
import { formatPaise } from "@/lib/trading/money";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail({ to, subject, text }: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      logger.error("email.send_failed", { status: response.status, subject });
      throw new Error(`The email provider returned HTTP ${response.status}.`);
    }
    return;
  }
  console.log(
    `\n──────── EMAIL (dev: no provider configured) ────────\n` +
      `To:      ${to}\n` +
      `Subject: ${subject}\n\n` +
      `${text}\n` +
      `─────────────────────────────────────────────────────\n`,
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Reset your WhiteSVAN password",
    text:
      `We received a request to reset your WhiteSVAN password.\n\n` +
      `Reset it here (link valid for 1 hour):\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
  });
}

/** How an order was settled, as its receipt states it: nothing is said to be paid that wasn't. */
export type OrderPayment = { kind: "paid"; amount: number; paymentId: string; test?: boolean } | { kind: "test" } | { kind: "free" };

export async function sendOrderConfirmation(to: string, order: { planLabel: string; planId: string; accountId: string; payment: OrderPayment }): Promise<void> {
  const { payment } = order;
  const settled =
    payment.kind === "paid" && payment.test ? `Test payment of ${formatPaise(payment.amount, 2)} in Razorpay test mode (${payment.paymentId}): no money was charged.`
    : payment.kind === "paid" ? `Payment received: ${formatPaise(payment.amount, 2)}, GST included (Razorpay payment ${payment.paymentId}).`
    : payment.kind === "test" ? "Test purchase: nothing was charged."
    : "No payment was taken for this evaluation.";
  await sendEmail({
    to,
    subject: `Your ${order.planLabel} demo account is ready`,
    text:
      `Your ${order.planLabel} WhiteSVAN evaluation is open: demo account ${accountNumber(order.accountId, order.planId)}.\n\n` +
      `${settled}\n\n` +
      `Open the trading platform:\n${SITE_URL}/trade/${order.accountId}\n\n` +
      `The rules: ${SITE_URL}/rules\n\n` +
      `Demo and funded accounts are simulated. Nothing here is investment advice.`,
  });
}

/** Tells staff a trader passed, so KYC, the agreement and bank details can start. */
export async function sendStaffFundedNotice(to: string[], account: { traderEmail: string; planLabel: string; planId: string; evaluationId: string; accountId: string }): Promise<void> {
  if (to.length === 0) return;
  await Promise.all(to.map((address) => sendEmail({
    to: address,
    subject: `Passed: ${account.traderEmail}, ${account.planLabel}`,
    text:
      `${account.traderEmail} passed a ${account.planLabel} evaluation (${accountNumber(account.evaluationId, account.planId)}).\n\n` +
      `Their funded account ${accountNumber(account.accountId, account.planId)} is open. Next: KYC, the funded trader agreement and bank details before the first payout.`,
  })));
}

export async function sendFundedAccountEmail(to: string, account: { planLabel: string; planId: string; accountId: string }): Promise<void> {
  await sendEmail({
    to,
    subject: `You passed: your ${account.planLabel} funded account is open`,
    text:
      `You passed your ${account.planLabel} evaluation. Your funded account ${accountNumber(account.accountId, account.planId)} is open, with the same loss limits and no profit target.\n\n` +
      `Trade it here:\n${SITE_URL}/trade/${account.accountId}\n\n` +
      `Your payout figures (profit above the buffer, your split and the cap) are on ${SITE_URL}/payouts. Before your first payout you complete KYC, sign your funded trader agreement and add your bank account.\n\n` +
      `Funded accounts are simulated. Payouts follow the rules: ${SITE_URL}/rules#desk`,
  });
}
