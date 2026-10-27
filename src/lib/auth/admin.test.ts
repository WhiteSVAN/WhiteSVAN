import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
import { requireAdmin } from "./dal";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("admin access", () => {
  it("sends a signed-out visitor to sign in and back to the portal", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login?next=%2Fadmin");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("shows a signed-in trader nothing: the portal answers 404", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "trader" } });
    mocks.findUnique.mockResolvedValue({ id: "trader", email: "ops@whitesvan.test", name: null, isAdmin: false });
    await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("reads the flag from the database on every check, not from the session or the email", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "founder", email: "founder@example.test", isAdmin: true } });
    mocks.findUnique.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
    mocks.findUnique.mockResolvedValue({ id: "founder", email: "founder@example.test", name: "Founder", isAdmin: true });
    await expect(requireAdmin()).resolves.toMatchObject({ id: "founder", isAdmin: true });
    expect(mocks.findUnique).toHaveBeenLastCalledWith({ where: { id: "founder" }, select: { id: true, email: true, name: true, isAdmin: true } });
  });
});
