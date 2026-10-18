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
import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/site";

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

export async function sendOrderConfirmation(to: string, order: { planLabel: string; accountNumber: string; accountId: string }): Promise<void> {
  await sendEmail({
    to,
    subject: `Your ${order.planLabel} evaluation is ready`,
    text:
      `Your ${order.planLabel} WhiteSVAN evaluation is open. Account ${order.accountNumber}.\n\n` +
      `Open the trading platform:\n${SITE_URL}/trade/${order.accountId}\n\n` +
      `The rules: ${SITE_URL}/rules\n\n` +
      `Evaluation and funded accounts are simulated. Nothing here is investment advice.`,
  });
}
