import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { capturedPayment, createRazorpayOrder, fetchRazorpayPayment, paymentSignatureValid, razorpayConfig, RazorpayError, webhookSignatureValid } from "./razorpay";

const sign = (secret: string, message: string) => createHmac("sha256", secret).update(message).digest("hex");
const config = razorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_key", RAZORPAY_KEY_SECRET: "key-secret", RAZORPAY_WEBHOOK_SECRET: "hook-secret" })!;

describe("razorpay config", () => {
  it("needs both keys, and takes a stand-in API only outside production", () => {
    expect(razorpayConfig({})).toBeNull();
    expect(razorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_key" })).toBeNull();
    expect(config).toEqual({ keyId: "rzp_test_key", keySecret: "key-secret", webhookSecret: "hook-secret", apiRoot: "https://api.razorpay.com/v1", testMode: true });
    const keys = { RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s", RAZORPAY_API_ROOT: "http://127.0.0.1:4556/v1" };
    expect(razorpayConfig({ ...keys, NODE_ENV: "development" })?.apiRoot).toBe("http://127.0.0.1:4556/v1");
    expect(razorpayConfig({ ...keys, NODE_ENV: "production" })?.apiRoot).toBe("https://api.razorpay.com/v1");
    expect(razorpayConfig(keys)?.webhookSecret).toBeNull();
  });
});

describe("razorpay signatures", () => {
  it("accepts the checkout signature over our stored order id and the payment id, and nothing else", () => {
    const signature = sign("key-secret", "order_ABC123|pay_XYZ789");
    expect(paymentSignatureValid("key-secret", "order_ABC123", "pay_XYZ789", signature)).toBe(true);
    expect(paymentSignatureValid("key-secret", "order_ABC123", "pay_XYZ789", signature.toUpperCase())).toBe(true);
    expect(paymentSignatureValid("key-secret", "order_OTHER1", "pay_XYZ789", signature)).toBe(false);
    expect(paymentSignatureValid("key-secret", "order_ABC123", "pay_OTHER1", signature)).toBe(false);
    expect(paymentSignatureValid("other-secret", "order_ABC123", "pay_XYZ789", signature)).toBe(false);
    for (const bad of ["", "zz", signature.slice(1), `${signature}00`]) expect(paymentSignatureValid("key-secret", "order_ABC123", "pay_XYZ789", bad)).toBe(false);
  });

  it("checks webhooks against the raw body with the webhook secret", () => {
    const body = '{"event":"payment.captured","payload":{}}';
    expect(webhookSignatureValid("hook-secret", body, sign("hook-secret", body))).toBe(true);
    expect(webhookSignatureValid("hook-secret", `${body} `, sign("hook-secret", body))).toBe(false);
    expect(webhookSignatureValid("key-secret", body, sign("hook-secret", body))).toBe(false);
  });
});

describe("razorpay events", () => {
  const payment = { id: "pay_XYZ789", order_id: "order_ABC123", amount: 8_999_00, status: "captured" };

  it("reads the captured payment from payment.captured and order.paid", () => {
    expect(capturedPayment({ event: "payment.captured", payload: { payment: { entity: payment } } })).toEqual({ razorpayOrderId: "order_ABC123", paymentId: "pay_XYZ789", amount: 8_999_00 });
    expect(capturedPayment({ event: "order.paid", payload: { order: { entity: { id: "order_ABC123" } }, payment: { entity: payment } } })).toEqual({ razorpayOrderId: "order_ABC123", paymentId: "pay_XYZ789", amount: 8_999_00 });
  });

  it("ignores other events and payments that aren't captured", () => {
    expect(capturedPayment({ event: "payment.authorized", payload: { payment: { entity: { ...payment, status: "authorized" } } } })).toBeNull();
    expect(capturedPayment({ event: "payment.captured", payload: { payment: { entity: { ...payment, status: "failed" } } } })).toBeNull();
    expect(capturedPayment({ event: "payment.captured", payload: {} })).toBeNull();
    expect(capturedPayment(null)).toBeNull();
    expect(capturedPayment("payment.captured")).toBeNull();
  });
});

describe("razorpay orders", () => {
  it("creates an INR order for the amount with basic auth, our order id as the receipt", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: "order_ABC123", amount: 8_999_00, currency: "INR", status: "created" }));
    const order = await createRazorpayOrder(config, { amount: 8_999_00, receipt: "ord_1", notes: { order: "ord_1", plan: "5l" } }, fetchImpl as unknown as typeof fetch);
    expect(order).toEqual({ id: "order_ABC123", amount: 8_999_00, currency: "INR", status: "created" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("rzp_test_key:key-secret").toString("base64")}`);
    expect(JSON.parse(String(init.body))).toEqual({ amount: 8_999_00, currency: "INR", receipt: "ord_1", notes: { order: "ord_1", plan: "5l" } });
  });

  it("reports Razorpay's refusal, and an order for a different amount", async () => {
    const refused = vi.fn(async () => Response.json({ error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } }, { status: 401 }));
    await expect(createRazorpayOrder(config, { amount: 8_999_00, receipt: "ord_1", notes: {} }, refused as unknown as typeof fetch)).rejects.toThrow("Razorpay refused the order: Authentication failed");
    const wrong = vi.fn(async () => Response.json({ id: "order_ABC123", amount: 100 }));
    await expect(createRazorpayOrder(config, { amount: 8_999_00, receipt: "ord_1", notes: {} }, wrong as unknown as typeof fetch)).rejects.toBeInstanceOf(RazorpayError);
    await expect(createRazorpayOrder(config, { amount: 99, receipt: "ord_1", notes: {} })).rejects.toThrow(RangeError);
  });
});

describe("razorpay payment verification", () => {
  const payment = { id: "pay_XYZ789", order_id: "order_ABC123", amount: 8_999_00, currency: "INR", status: "captured", captured: true };

  it("fetches fresh payment details from the authenticated server API", async () => {
    const fetchImpl = vi.fn(async () => Response.json(payment));
    await expect(fetchRazorpayPayment(config, payment.id, fetchImpl as unknown as typeof fetch)).resolves.toEqual(payment);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/payments/pay_XYZ789");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("rzp_test_key:key-secret").toString("base64")}`);
  });

  it("preserves an authorized status so the caller can wait for capture", async () => {
    const authorized = { ...payment, status: "authorized", captured: false };
    await expect(fetchRazorpayPayment(config, payment.id, (async () => Response.json(authorized)) as typeof fetch)).resolves.toEqual(authorized);
  });

  it.each([
    null,
    { ...payment, id: "pay_OTHER1" },
    { ...payment, order_id: null },
    { ...payment, amount: 100.5 },
    { ...payment, amount: -1 },
    { ...payment, captured: undefined },
  ])("rejects malformed or mismatched API details: %j", async (body) => {
    await expect(fetchRazorpayPayment(config, payment.id, (async () => Response.json(body)) as typeof fetch)).rejects.toBeInstanceOf(RazorpayError);
  });

  it("rejects API failures and malformed payment ids", async () => {
    const failed = vi.fn(async () => Response.json({ error: {} }, { status: 503 }));
    await expect(fetchRazorpayPayment(config, payment.id, failed as unknown as typeof fetch)).rejects.toThrow("could not verify the payment");
    await expect(fetchRazorpayPayment(config, "../orders", failed as unknown as typeof fetch)).rejects.toThrow(RangeError);
    expect(failed).toHaveBeenCalledTimes(1);
  });
});
