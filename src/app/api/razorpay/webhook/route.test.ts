import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fulfil: vi.fn(), receipt: vi.fn(), config: vi.fn() }));
vi.mock("@/lib/checkout/orders", () => ({ fulfilRazorpayOrder: mocks.fulfil, CheckoutError: class extends Error {} }));
vi.mock("@/lib/checkout/receipt", () => ({ sendReceipt: mocks.receipt }));
vi.mock("@/lib/checkout/razorpay", async (original) => ({ ...(await original<typeof import("@/lib/checkout/razorpay")>()), razorpayConfig: mocks.config }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import { POST } from "./route";

const secret = "local-webhook-test-secret";
const entity = { id: "pay_ROUTE123", order_id: "order_ROUTE123", amount: 299_900, currency: "INR", status: "captured" };
function request(payment = entity, signatureValid = true, event = "payment.captured") {
  const raw = JSON.stringify({ event, payload: { payment: { entity: payment } } });
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  return new Request("http://localhost/api/razorpay/webhook", { method: "POST", body: raw, headers: { "x-razorpay-signature": signatureValid ? signature : "00" } }) as NextRequest;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ webhookSecret: secret });
  mocks.fulfil.mockResolvedValue({ orderId: "local-order", accountId: "local-account", userId: "local-user", planId: "1l", email: "local@example.test", amount: entity.amount, provider: "razorpay-test", opened: true });
});

describe("signed Razorpay webhooks", () => {
  it("stays unavailable without its configured webhook secret", async () => {
    mocks.config.mockReturnValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.fulfil).not.toHaveBeenCalled();
  });
  it("rejects invalid signatures without touching an account", async () => {
    expect((await POST(request(entity, false))).status).toBe(400);
    expect(mocks.fulfil).not.toHaveBeenCalled();
  });
  it.each([
    { ...entity, currency: "USD" },
    { ...entity, currency: "" },
    { ...entity, amount: 299_900.5 },
    { ...entity, amount: 0 },
  ])("does not fulfill a signed event with invalid currency/amount: %j", async (payment) => {
    expect((await POST(request(payment))).status).toBe(200);
    expect(mocks.fulfil).not.toHaveBeenCalled();
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
  it("fulfills only an INR capture and sends one test-mode receipt across duplicates", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.fulfil).toHaveBeenCalledWith(expect.objectContaining({ razorpayOrderId: entity.order_id, paymentId: entity.id, amount: entity.amount }));
    expect(mocks.receipt).toHaveBeenCalledWith("local@example.test", expect.any(Object), expect.objectContaining({ kind: "paid", test: true }));
    mocks.fulfil.mockResolvedValue({ opened: false });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.receipt).toHaveBeenCalledTimes(1);
  });
  it("ignores signed authorization events until capture", async () => {
    expect((await POST(request(entity, true, "payment.authorized"))).status).toBe(200);
    expect(mocks.fulfil).not.toHaveBeenCalled();
  });
});
