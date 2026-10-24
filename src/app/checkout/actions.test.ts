import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), member: vi.fn(), user: vi.fn(), purchase: vi.fn(), email: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/dal", () => ({ requireMember: mocks.member }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.user } } }));
vi.mock("@/lib/checkout/orders", async (original) => ({ ...(await original<typeof import("@/lib/checkout/orders")>()), completePurchase: mocks.purchase }));
vi.mock("@/lib/email", () => ({ sendOrderConfirmation: mocks.email }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { checkout } from "./actions";

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
  it("passes the selected plan and stable attempt key to the transaction", async () => {
    await expect(checkout(undefined, submission({ plan: "10l" }))).rejects.toThrow("REDIRECT:/checkout/complete/order");
    expect(mocks.purchase).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", mode: "demo", attemptId: attempt, plan: expect.objectContaining({ id: "10l" }) }));
  });
  it("retains billing details on validation failures without writing", async () => {
    const result = await checkout(undefined, submission({ phone: "123" }));
    expect(result?.errors?.phone).toBeDefined();
    expect(result?.values?.phone).toBe("123");
    expect(mocks.purchase).not.toHaveBeenCalled();
  });
  it("continues to allow fully onboarded clients to use demo evaluations", async () => {
    mocks.member.mockResolvedValue({ id: "owner", role: "CLIENT", clientProfile: { id: "client" } });
    await expect(checkout(undefined, submission())).rejects.toThrow("REDIRECT:/checkout/complete/order");
    expect(mocks.purchase).toHaveBeenCalledTimes(1);
  });
});
