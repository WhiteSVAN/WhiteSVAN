/**
 * How checkout takes payment. With Razorpay's keys set, traders pay the fee through Razorpay
 * Checkout (razorpay.ts). Until they are, evaluations open without payment ("free"): the order
 * records nothing charged and no screen or email says a payment was taken. The sign-ins in
 * STAFF_EMAILS always make test purchases (no charge), so staff can open accounts either way.
 */
import { razorpayConfig } from "./razorpay";

export type CheckoutMode = "test" | "razorpay" | "free";

type Env = Partial<Record<string, string>>;

export function staffEmails(env: Env = process.env): string[] {
  return (env.STAFF_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function checkoutModeFor(email: string | null | undefined, env: Env = process.env): CheckoutMode {
  if (email && staffEmails(env).includes(email.trim().toLowerCase())) return "test";
  return razorpayConfig(env) ? "razorpay" : "free";
}
