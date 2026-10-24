/**
 * How checkout takes payment. No payment gateway is signed yet (Razorpay or Cashfree, TRD
 * "Payments"). Until one is, the sign-ins in STAFF_EMAILS make test purchases (no charge, no
 * credit used), and everyone else buys demo evaluations with virtual demo credit (demo.ts). With
 * demo mode off, checkout is closed to the public. A gateway adds a live mode.
 */
import { DEMO_CHECKOUT } from "./demo";

export type CheckoutMode = "test" | "demo" | "closed";

type Env = Partial<Record<string, string>>;

export function staffEmails(env: Env = process.env): string[] {
  return (env.STAFF_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function checkoutModeFor(email: string | null | undefined, env: Env = process.env, demo = DEMO_CHECKOUT): CheckoutMode {
  if (email && staffEmails(env).includes(email.trim().toLowerCase())) return "test";
  return demo ? "demo" : "closed";
}
