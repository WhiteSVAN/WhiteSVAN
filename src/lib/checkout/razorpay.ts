/**
 * Razorpay Standard Checkout (server only): orders are created here with the key secret, the
 * browser opens Checkout.js on the order, and a payment counts once its signature checks out
 * and the API verifies capture, or a signed webhook reports capture. Amounts are in paise.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

type Env = Partial<Record<string, string>>;

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  /** Signs webhooks; set in the dashboard when the webhook is added. Optional: the browser's handler still completes orders. */
  webhookSecret: string | null;
  apiRoot: string;
  /** Test keys (`rzp_test_…`): Razorpay's test mode, where payments are simulated and no money moves. */
  testMode: boolean;
}

/** Orders are recorded with the mode they were paid in, so a test payment never reads as money received. */
export const RAZORPAY_PROVIDERS = ["razorpay", "razorpay-test"] as const;
export const razorpayProvider = (config: Pick<RazorpayConfig, "testMode">) => (config.testMode ? "razorpay-test" : "razorpay");

/** Razorpay's test-mode details, shown at checkout so a demo can pay without real money. */
export const TEST_PAYMENT = { upi: "success@razorpay", card: "4100 2800 0000 1007" } as const;

/**
 * Razorpay's keys, or null when they aren't set (checkout then opens evaluations without payment).
 * Outside production only, RAZORPAY_API_ROOT points at a stand-in API for local tests.
 */
export function razorpayConfig(env: Env = process.env): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  const standIn = env.NODE_ENV !== "production" ? env.RAZORPAY_API_ROOT?.trim() : undefined;
  return { keyId, keySecret, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET?.trim() || null, apiRoot: standIn || "https://api.razorpay.com/v1", testMode: keyId.startsWith("rzp_test_") };
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
}

export class RazorpayError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RazorpayError";
    this.status = status;
  }
}

/** A Razorpay order for `amount` paise; `receipt` is our order id (40 characters at most). */
export async function createRazorpayOrder(
  config: RazorpayConfig,
  input: { amount: number; receipt: string; notes: Record<string, string> },
  fetchImpl: typeof fetch = fetch,
): Promise<RazorpayOrder> {
  if (!Number.isSafeInteger(input.amount) || input.amount < 100) throw new RangeError("A Razorpay order needs at least 100 paise.");
  const response = await fetchImpl(`${config.apiRoot}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: input.amount, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes }),
    signal: AbortSignal.timeout(15_000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const description = typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "description" in body.error ? String(body.error.description) : `HTTP ${response.status}`;
    throw new RazorpayError(`Razorpay refused the order: ${description}`, response.status);
  }
  const order = body as Partial<RazorpayOrder> | null;
  if (!order || typeof order.id !== "string" || !/^order_\w{6,40}$/.test(order.id) || order.amount !== input.amount || order.currency !== "INR" || order.status !== "created") throw new RazorpayError("Razorpay returned an unexpected order.", 502);
  return { id: order.id, amount: order.amount, currency: order.currency, status: order.status };
}

/** Fetch authoritative payment state: a Checkout signature alone does not prove capture. */
export async function fetchRazorpayPayment(
  config: RazorpayConfig,
  paymentId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RazorpayPayment> {
  if (!/^pay_\w{6,40}$/.test(paymentId)) throw new RangeError("Invalid Razorpay payment id.");
  const response = await fetchImpl(`${config.apiRoot}/payments/${paymentId}`, {
    method: "GET",
    headers: { Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new RazorpayError("Razorpay could not verify the payment.", response.status);
  const body: unknown = await response.json().catch(() => null);
  const payment = body as Partial<RazorpayPayment> | null;
  if (!payment || payment.id !== paymentId || typeof payment.order_id !== "string" || typeof payment.amount !== "number" || !Number.isSafeInteger(payment.amount) || payment.amount < 1 || typeof payment.currency !== "string" || typeof payment.status !== "string" || typeof payment.captured !== "boolean") {
    throw new RazorpayError("Razorpay returned an unexpected payment.", 502);
  }
  return { id: payment.id, order_id: payment.order_id, amount: payment.amount, currency: payment.currency, status: payment.status, captured: payment.captured };
}

function sameHex(expected: string, given: string): boolean {
  if (!/^[0-9a-f]+$/i.test(given) || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(given.toLowerCase(), "hex"));
}

/** The browser handler's signature: HMAC-SHA256 of "<our stored order id>|<payment id>" with the key secret. */
export function paymentSignatureValid(keySecret: string, razorpayOrderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac("sha256", keySecret).update(`${razorpayOrderId}|${paymentId}`).digest("hex");
  return sameHex(expected, signature);
}

/** A webhook's X-Razorpay-Signature: HMAC-SHA256 of the raw body with the webhook secret. */
export function webhookSignatureValid(webhookSecret: string, rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return sameHex(expected, signature);
}

/**
 * The payment a webhook reports as taken: `payment.captured` and `order.paid` both carry the
 * payment entity. Null for any other event, or a payment that isn't captured.
 */
export function capturedPayment(event: unknown): { razorpayOrderId: string; paymentId: string; amount: number } | null {
  if (typeof event !== "object" || event === null || !("event" in event) || !("payload" in event)) return null;
  if (event.event !== "payment.captured" && event.event !== "order.paid") return null;
  const payment = (event.payload as { payment?: { entity?: Record<string, unknown> } } | null)?.payment?.entity;
  if (!payment || payment.status !== "captured" || payment.currency !== "INR" || typeof payment.id !== "string" || !/^pay_\w{6,40}$/.test(payment.id) || typeof payment.order_id !== "string" || !/^order_\w{6,40}$/.test(payment.order_id) || typeof payment.amount !== "number" || !Number.isSafeInteger(payment.amount) || payment.amount < 1) return null;
  return { razorpayOrderId: payment.order_id, paymentId: payment.id, amount: payment.amount };
}
