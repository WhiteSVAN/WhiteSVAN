import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), hash: vi.fn() }));
vi.mock("@/auth", () => ({ signIn: mocks.signIn }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUnique, create: mocks.create, updateMany: mocks.updateMany } } }));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
import { AuthError } from "next-auth";
import { Prisma } from "@/generated/prisma/client";
import { joinWithPassword } from "./join";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "new-user" });
  mocks.signIn.mockResolvedValue("/");
  mocks.hash.mockResolvedValue("test-hash");
});

describe("joining at checkout", () => {
  it("creates a trader for a new email and signs in without leaving the page", async () => {
    mocks.findUnique.mockImplementation(({ where }: { where: { email?: string; referralCode?: string } }) => Promise.resolve(where.referralCode ? { id: "referrer" } : null));
    const result = await joinWithPassword({ email: "new@example.test", password: "Trader12345", referral: "AbCdEf12" });
    expect(result).toEqual({ joined: true, userId: "new-user", email: "new@example.test", created: true });
    expect(mocks.create).toHaveBeenCalledWith({ data: { email: "new@example.test", passwordHash: "test-hash", role: "TRADER", referredById: "referrer" }, select: { id: true } });
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", { email: "new@example.test", password: "Trader12345", redirect: false });
  });

  it("holds a new account to the password rule, before creating anything", async () => {
    const result = await joinWithPassword({ email: "new@example.test", password: "short" });
    expect(result.joined).toBe(false);
    expect(!result.joined && result.errors?.password?.[0]).toBe("Use at least 8 characters.");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("signs an existing account in with its password instead of creating one", async () => {
    mocks.findUnique.mockResolvedValue({ id: "existing", passwordHash: "hash", role: "TRADER" });
    expect(await joinWithPassword({ email: "known@example.test", password: "anything-old" })).toEqual({ joined: true, userId: "existing", email: "known@example.test", created: false });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("says so when the password doesn't open the existing account", async () => {
    mocks.findUnique.mockResolvedValue({ id: "existing", passwordHash: "hash", role: "TRADER" });
    mocks.signIn.mockRejectedValue(new AuthError("CredentialsSignin"));
    const result = await joinWithPassword({ email: "known@example.test", password: "wrong" });
    expect(result).toEqual({ joined: false, errors: { password: ["That isn't the password for this email. Log in, or reset your password."] } });
  });

  it("makes an account from before roles a trader once it signs in", async () => {
    mocks.findUnique.mockResolvedValue({ id: "older", passwordHash: "hash", role: null });
    await joinWithPassword({ email: "older@example.test", password: "Trader12345" });
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "older", role: null }, data: { role: "TRADER" } });
  });

  it("sends a Google account to Google, and catches two sign-ups racing on one email", async () => {
    mocks.findUnique.mockResolvedValue({ id: "google", passwordHash: null, role: "TRADER" });
    expect(await joinWithPassword({ email: "g@example.test", password: "Trader12345" })).toEqual({ joined: false, errors: { email: ["This email signs in with Google: use Continue with Google."] } });
    expect(mocks.signIn).not.toHaveBeenCalled();

    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }));
    expect(await joinWithPassword({ email: "race@example.test", password: "Trader12345" })).toEqual({ joined: false, errors: { email: ["An account with this email was just created. Log in to continue."] } });
  });

  it("asks for a real email and a password", async () => {
    const result = await joinWithPassword({ email: "not-an-email", password: "" });
    expect(!result.joined && result.errors).toEqual({ email: ["Enter a valid email."], password: ["Enter a password."] });
  });
});
