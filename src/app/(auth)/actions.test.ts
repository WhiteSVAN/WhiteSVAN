import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), findUnique: vi.fn(), create: vi.fn(), cookies: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock("@/auth", () => ({ signIn: mocks.signIn }));
vi.mock("next-auth", () => ({ AuthError: class extends Error {} }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUnique, create: mocks.create } } }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("test-hash") } }));
vi.mock("@/lib/auth/reset", () => ({ createPasswordResetToken: vi.fn(), consumePasswordResetToken: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
import { signInWithGoogle, signup } from "./actions";

const jar = new Map<string, string>();
function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const valid = { name: "Integration Trader", email: "signup@example.test", password: "Integration123", role: "TRADER" };

beforeEach(() => {
  vi.resetAllMocks();
  jar.clear();
  mocks.cookies.mockResolvedValue({ set: mocks.set, delete: mocks.remove });
  mocks.set.mockImplementation((key: string, value: string) => jar.set(key, value));
  mocks.remove.mockImplementation((key: string) => jar.delete(key));
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "new-user" });
});

describe("signup continuation", () => {
  it("honors an explicit safe return path even when a plan was supplied", async () => {
    await signup(undefined, form({ ...valid, plan: "1l", next: "/dashboard" }));
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", expect.objectContaining({ redirectTo: "/dashboard" }));
  });
  it("uses a chosen plan when there is no valid explicit return path", async () => {
    await signup(undefined, form({ ...valid, plan: "1l", next: "https://other.example" }));
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", expect.objectContaining({ redirectTo: "/checkout/1l" }));
  });
  it("makes every sign-up a trader (the client role is switched off) and defaults to checkout", async () => {
    await signup(undefined, form({ ...valid, role: "CLIENT", next: "/checkout" }));
    expect(mocks.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: "TRADER" }) }));
    expect(mocks.signIn).toHaveBeenLastCalledWith("credentials", expect.objectContaining({ redirectTo: "/checkout" }));
    await signup(undefined, form(valid));
    expect(mocks.signIn).toHaveBeenLastCalledWith("credentials", expect.objectContaining({ redirectTo: "/checkout" }));
  });
});

describe("Google signup context", () => {
  it("clears role and referral from an abandoned attempt when the next attempt has no context", async () => {
    await signInWithGoogle(form({ role: "TRADER", ref: "abcdef", next: "/checkout" }));
    expect(jar.get("signup_role")).toBe("TRADER");
    expect(jar.get("signup_ref")).toBe("abcdef");
    await signInWithGoogle(form({}));
    expect(jar.has("signup_role")).toBe(false);
    expect(jar.has("signup_ref")).toBe(false);
    expect(mocks.signIn).toHaveBeenLastCalledWith("google", { redirectTo: "/onboarding/continue" });
  });
  it("replaces the chosen role, omits stale referral, and rejects unsafe return paths", async () => {
    jar.set("signup_role", "TRADER"); jar.set("signup_ref", "oldref");
    await signInWithGoogle(form({ role: "CLIENT", next: "//other.example" }));
    expect(jar.get("signup_role")).toBe("CLIENT");
    expect(jar.has("signup_ref")).toBe(false);
    expect(mocks.signIn).toHaveBeenLastCalledWith("google", { redirectTo: "/onboarding/continue" });
  });
});
