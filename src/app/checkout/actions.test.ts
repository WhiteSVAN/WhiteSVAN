import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), member: vi.fn(), user: vi.fn(), order: vi.fn(), purchase: vi.fn(), startRazorpay: vi.fn(), fetchPayment: vi.fn(), fulfil: vi.fn(), email: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/dal", () => ({ requireMember: mocks.member }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.user }, checkoutOrder: { findFirst: mocks.order } } }));
vi.mock("@/lib/checkout/orders", async (original) => ({ ...(await original<typeof import("@/lib/checkout/orders")>()), completePurchase: mocks.purchase, startRazorpayOrder: mocks.startRazorpay, fulfilRazorpayOrder: mocks.fulfil }));
vi.mock("@/lib/checkout/razorpay", async (original) => ({ ...(await original<typeof import("@/lib/checkout/razorpay")>()), fetchRazorpayPayment: mocks.fetchPayment }));
vi.mock("@/lib/email", () => ({ sendOrderConfirmation: mocks.email }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { checkout, confirmPayment } from "./actions";

const attempt = "3e48b07d-0dca-4dd1-8b4f-22013d642b84";
function submission(fields: Record<string, string> = {}) {
  const data = new FormData();
  const defaults = { plan: "1l", attempt, name: "Integration Trader", phone: "9876543210", state: "Telangana", terms: "on" };
  for (const [key, value] of Object.entries({ ...defaults, ...fields })) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  mocks.member.mockResolvedValue({ id: "owner", role: "TRADER" });
  mocks.user.mockResolvedValue({ email: "owner@example.test" });
  mocks.purchase.mockResolvedValue({ orderId: "order", accountId: "account" });
  mocks.email.mockResolvedValue(undefined);
});

describe("checkout server action", () => {
  it("does not provision an account before membership onboarding finishes", async () => {
    mocks.member.mockRejectedValue(new Error("REDIRECT:/onboarding"));
    await expect(checkout(undefined, submission())).rejects.toThrow("REDIRECT:/onboarding");
    expect(mocks.purchase).not.toHaveBeenCalled();
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("preserves plan-aware sign-in recovery for an expired session", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(checkout(undefined, submission())).rejects.toThrow("REDIRECT:/login?");
    expect(mocks.purchase).not.toHaveBeenCalled();
  });
  it("rejects a missing or malformed attempt before a purchase", async () => {
    const result = await checkout(undefined, submission({ attempt: "bad" }));
    expect(result?.message).toBe("Refresh checkout and try again.");
    expect(result?.values?.name).toBe("Integration Trader");
    expect(mocks.purchase).not.toHaveBeenCalled();
  });
  it("starts free without Razorpay keys, with the selected plan and the stable attempt key", async () => {
    await expect(checkout(undefined, submission({ plan: "10l" }))).rejects.toThrow("REDIRECT:/checkout/complete/order");
    expect(mocks.purchase).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", mode: "free", attemptId: attempt, plan: expect.objectContaining({ id: "10l" }) }));
    expect(mocks.email).toHaveBeenCalledWith("owner@example.test", expect.objectContaining({ accountId: "account", payment: { kind: "free" } }));
    expect(mocks.startRazorpay).not.toHaveBeenCalled();
  });
  it("retains billing details on validation failures without writing", async () => {
    const result = await checkout(undefined, submission({ phone: "123" }));
    expect(result?.errors?.phone).toBeDefined();
    expect(result?.values?.phone).toBe("123");
    expect(mocks.purchase).not.toHaveBeenCalled();
  });
  it("continues to allow fully onboarded clients to start evaluations", async () => {
    mocks.member.mockResolvedValue({ id: "owner", role: "CLIENT", clientProfile: { id: "client" } });
    await expect(checkout(undefined, submission())).rejects.toThrow("REDIRECT:/checkout/complete/order");
    expect(mocks.purchase).toHaveBeenCalledTimes(1);
  });
});

describe("razorpay checkout", () => {
  beforeEach(() => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "key-secret");
    mocks.startRazorpay.mockResolvedValue({ orderId: "order", razorpayOrderId: "order_RZP123", amount: 8_999_00 });
    mocks.order.mockResolvedValue({ providerOrderId: "order_RZP123", amount: 8_999_00 });
    mocks.fetchPayment.mockResolvedValue({ id: "pay_ABC123", order_id: "order_RZP123", amount: 8_999_00, currency: "INR", status: "captured", captured: true });
    mocks.fulfil.mockResolvedValue({ orderId: "order", accountId: "account", userId: "owner", planId: "5l", email: "owner@example.test", amount: 8_999_00, opened: true });
  });
  afterEach(() => vi.unstubAllEnvs());
  const signature = createHmac("sha256", "key-secret").update("order_RZP123|pay_ABC123").digest("hex");

  it("creates the order and hands it to the browser to pay, opening no account yet", async () => {
    const result = await checkout(undefined, submission({ plan: "5l" }));
    expect(result?.payment).toEqual({ orderId: "order", razorpayOrderId: "order_RZP123", amount: 8_999_00, keyId: "rzp_test_key", description: "₹5L evaluation", prefill: { name: "Integration Trader", email: "owner@example.test", contact: "+919876543210" } });
    expect(mocks.purchase).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("says payments are unavailable when Razorpay can't create the order", async () => {
    mocks.startRazorpay.mockRejectedValue(new Error("socket hang up"));
    const result = await checkout(undefined, submission());
    expect(result?.message).toBe("Payments are unavailable right now. Try again in a minute.");
    expect(result?.values?.state).toBe("Telangana");
  });

  it("opens the account only for a payment signed against the order we stored", async () => {
    const forged = await confirmPayment({ orderId: "order", paymentId: "pay_ABC123", signature: "00" });
    expect(forged?.message).toContain("couldn't verify");
    expect(mocks.fulfil).not.toHaveBeenCalled();
    expect(mocks.fetchPayment).not.toHaveBeenCalled();
    await expect(confirmPayment({ orderId: "order", paymentId: "pay_ABC123", signature })).rejects.toThrow("REDIRECT:/checkout/complete/order");
    expect(mocks.order).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "order", userId: "owner", provider: "razorpay" } }));
    expect(mocks.fetchPayment).toHaveBeenCalledWith(expect.objectContaining({ keyId: "rzp_test_key" }), "pay_ABC123");
    expect(mocks.fulfil).toHaveBeenCalledWith(expect.objectContaining({ razorpayOrderId: "order_RZP123", paymentId: "pay_ABC123", amount: 8_999_00 }));
    expect(mocks.email).toHaveBeenCalledWith("owner@example.test", expect.objectContaining({ payment: { kind: "paid", amount: 8_999_00, paymentId: "pay_ABC123" } }));
  });

  it("sends one receipt when the webhook opened the account first", async () => {
    mocks.fulfil.mockResolvedValue({ orderId: "order", accountId: "account", userId: "owner", planId: "5l", email: "owner@example.test", amount: 8_999_00, opened: false });
    await expect(confirmPayment({ orderId: "order", paymentId: "pay_ABC123", signature })).rejects.toThrow("REDIRECT:/checkout/complete/order");
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each(["authorized", "created", "failed", "refunded"])("does not open an account for a signed but %s payment", async (status) => {
    mocks.fetchPayment.mockResolvedValue({ id: "pay_ABC123", order_id: "order_RZP123", amount: 8_999_00, currency: "INR", status, captured: false });
    expect((await confirmPayment({ orderId: "order", paymentId: "pay_ABC123", signature }))?.message).toContain("awaiting confirmation");
    expect(mocks.fulfil).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each([
    { order_id: "order_OTHER1" },
    { amount: 100 },
    { currency: "USD" },
  ])("does not fulfill a captured payment whose details mismatch: %j", async (mismatch) => {
    mocks.fetchPayment.mockResolvedValue({ id: "pay_ABC123", order_id: "order_RZP123", amount: 8_999_00, currency: "INR", status: "captured", captured: true, ...mismatch });
    expect((await confirmPayment({ orderId: "order", paymentId: "pay_ABC123", signature }))?.message).toContain("couldn't verify the payment details");
    expect(mocks.fulfil).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("leaves the order pending when the verification API is unavailable", async () => {
    mocks.fetchPayment.mockRejectedValue(new Error("timeout"));
    expect((await confirmPayment({ orderId: "order", paymentId: "pay_ABC123", signature }))?.message).toContain("couldn't confirm the payment right now");
    expect(mocks.fulfil).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("requires the capture flag as well as the captured status", async () => {
    mocks.fetchPayment.mockResolvedValue({ id: "pay_ABC123", order_id: "order_RZP123", amount: 8_999_00, currency: "INR", status: "captured", captured: false });
    expect((await confirmPayment({ orderId: "order", paymentId: "pay_ABC123", signature }))?.message).toContain("awaiting confirmation");
    expect(mocks.fulfil).not.toHaveBeenCalled();
  });

  it("refuses someone else's order and malformed input without touching it", async () => {
    mocks.order.mockResolvedValue(null);
    expect((await confirmPayment({ orderId: "theirs", paymentId: "pay_ABC123", signature }))?.message).toContain("couldn't confirm");
    expect((await confirmPayment({ orderId: "order", paymentId: "not a payment", signature }))?.message).toContain("couldn't read");
    expect((await confirmPayment(null as unknown as { orderId: string; paymentId: string; signature: string }))?.message).toContain("couldn't read");
    expect(mocks.fulfil).not.toHaveBeenCalled();
  });
});
