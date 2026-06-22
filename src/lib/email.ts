/**
 * Outbound email.
 *
 * No transactional email provider is wired yet, so `sendEmail` logs the message
 * to the server console — enough to drive the password-reset flow in dev (read
 * the reset link from your `next dev` terminal). For production, replace the body
 * of `sendEmail` with a real provider (Resend, SES, SMTP via nodemailer); the
 * call sites don't need to change.
 *
 * Server-only by construction: only imported from Server Actions, so the reset
 * token is never returned to the browser — a forgot-password request can't be
 * used to enumerate accounts or steal tokens.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail({ to, subject, text }: EmailMessage): Promise<void> {
  // TODO: swap for a real provider. Keep it awaitable so the swap is drop-in.
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
    subject: "Reset your truSVAN password",
    text:
      `We received a request to reset your truSVAN password.\n\n` +
      `Reset it here (link valid for 1 hour):\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
  });
}
