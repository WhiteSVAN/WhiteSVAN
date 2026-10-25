/** A stable UUID from the checkout page, retained across validation failures and retries. */
export function isCheckoutAttemptId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Namespaced by authenticated owner and provider; never shared between users or payment modes. */
export function checkoutAttemptKey(userId: string, mode: "test" | "demo", attemptId: string): string {
  if (!isCheckoutAttemptId(attemptId)) throw new Error("Invalid checkout attempt.");
  return `checkout:${mode}:${userId}:${attemptId.toLowerCase()}`;
}
