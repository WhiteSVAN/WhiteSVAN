import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), rate: vi.fn(), ip: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { waitlistEntry: { upsert: mocks.upsert } } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rate }));
vi.mock("@/lib/request", () => ({ requestIpKey: mocks.ip }));
import { joinWaitlist } from "./waitlist-actions";

function submission(email: string) { const data = new FormData(); data.set("email", email); return data; }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rate.mockReturnValue({ ok: true });
  mocks.ip.mockResolvedValue("waitlist:test");
  mocks.upsert.mockResolvedValue({});
});

describe("joinWaitlist", () => {
  it("trims and normalizes before validation and upsert", async () => {
    expect(await joinWaitlist(undefined, submission("  Trader@Example.COM  "))).toEqual({ ok: true });
    expect(mocks.upsert).toHaveBeenCalledWith({ where: { email: "trader@example.com" }, create: { email: "trader@example.com" }, update: {} });
  });
  it("is idempotent for canonical email variants", async () => {
    await joinWaitlist(undefined, submission("trader@example.com"));
    await joinWaitlist(undefined, submission("TRADER@example.com"));
    expect(mocks.upsert.mock.calls[0][0]).toEqual(mocks.upsert.mock.calls[1][0]);
  });
  it.each(["invalid", "", "a".repeat(330) + "@example.com"])("rejects invalid input without a database write", async (email) => {
    expect(await joinWaitlist(undefined, submission(email))).toHaveProperty("error");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("does not write when rate limited", async () => {
    mocks.rate.mockReturnValue({ ok: false, retryAfterSeconds: 42 });
    expect(await joinWaitlist(undefined, submission("valid@example.com"))).toEqual({ error: "Too many submissions. Try again in 42 seconds." });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("returns a recoverable message instead of exposing database errors", async () => {
    mocks.upsert.mockRejectedValue(new Error("database credential details"));
    expect(await joinWaitlist(undefined, submission("valid@example.com"))).toEqual({ error: "Something went wrong. Please try again." });
  });
});
