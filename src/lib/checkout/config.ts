/**
 * How checkout takes payment. No payment gateway is signed yet (Razorpay or Cashfree, TRD
 * "Payments"), so checkout is closed to the public and the sign-ins in STAFF_EMAILS can make test
 * purchases that open a real evaluation account without a charge. A gateway adds a third mode.
 */
export type CheckoutMode = "test" | "closed";

type Env = Partial<Record<string, string>>;

export function staffEmails(env: Env = process.env): string[] {
  return (env.STAFF_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function checkoutModeFor(email: string | null | undefined, env: Env = process.env): CheckoutMode {
  return email && staffEmails(env).includes(email.trim().toLowerCase()) ? "test" : "closed";
}
