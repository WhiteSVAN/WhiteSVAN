import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { openDesk } from "@/lib/trading/desk";
import { ist } from "@/lib/trading/time";
import { customerDetail, customersPage, ordersForExport, ordersPage } from "./customers";
import { customerFilters, orderFilters } from "./filters";

const localDb = (() => {
  try { const url = new URL(process.env.DATABASE_URL ?? ""); return url.hostname === "127.0.0.1" && url.pathname === "/whitesvan_preview"; }
  catch { return false; }
})();

const plan = findEvaluationPlan("5l")!;
const STATES = ["Karnataka", "Telangana"];

describe.skipIf(!localDb)("admin customers and billing (PostgreSQL integration)", () => {
  const userIds: string[] = [];
  const tag = randomUUID().slice(0, 8);

  async function user(name: string, fields: Partial<Prisma.UserCreateInput> = {}) {
    const created = await prisma.user.create({ data: { email: `cust-${tag}-${name.toLowerCase()}@example.test`, name: `${name} ${tag}`, role: "TRADER", ...fields } });
    userIds.push(created.id);
    return created;
  }

  async function order(userId: string, email: string, fields: Partial<Prisma.CheckoutOrderUncheckedCreateInput>) {
    return prisma.checkoutOrder.create({ data: { userId, planId: plan.id, amount: plan.fee * 100, billingEmail: email, acceptedTermsAt: new Date(ist("2026-10-20 10:00")), provider: "free", status: "PAID", ...fields } });
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("lists customers with sign-in, referrals, accounts and only real money as received", async () => {
    const referrer = await user("Referrer", { referralCode: `R${tag}`, passwordHash: "never-read" });
    const payer = await user("Payer", { referredBy: { connect: { id: referrer.id } }, accounts: { create: { type: "oidc", provider: "google", providerAccountId: `g-${tag}`, access_token: "secret-token" } } });
    const browser = await user("Browser");
    const id = `ev-cust-${tag}`;
    await prisma.evaluationAccount.create({ data: { id, userId: payer.id, planId: plan.id, desk: openDesk(plan, id, ist("2026-10-20 10:00")) as unknown as Prisma.InputJsonValue } });
    await order(payer.id, payer.email!, { provider: "razorpay", status: "PAID", providerOrderId: `order_${tag}`, providerPaymentId: `pay_${tag}`, billingPhone: "+919876543210", billingState: "Karnataka", accountId: id, paidAt: new Date(ist("2026-10-20 10:01")) });
    await order(payer.id, payer.email!, { provider: "razorpay-test", status: "PAID", providerOrderId: `order_t${tag}` });
    await order(browser.id, browser.email!, { provider: "razorpay", status: "PENDING", providerOrderId: `order_p${tag}` });

    const { rows } = await customersPage(customerFilters({ q: tag }));
    const byName = Object.fromEntries(rows.map((row) => [row.name!.split(" ")[0], row]));
    expect(byName.Payer).toMatchObject({ google: true, password: false, orders: 2, received: plan.fee * 100, referredBy: { id: referrer.id }, accounts: { total: 1, active: 1 } });
    expect(byName.Referrer).toMatchObject({ password: true, google: false, referrals: 1, received: 0, referralCode: `R${tag}` });
    expect(byName.Browser).toMatchObject({ orders: 1, received: 0, accounts: { total: 0 } });
    expect(JSON.stringify(rows)).not.toContain("never-read");
    expect(JSON.stringify(rows)).not.toContain("secret-token");

    expect((await customersPage(customerFilters({ q: tag, show: "paying" }))).rows.map((row) => row.id)).toEqual([payer.id]);
    expect((await customersPage(customerFilters({ q: tag, show: "none" }))).rows.map((row) => row.id).sort()).toEqual([referrer.id, browser.id].sort());
    expect((await customersPage(customerFilters({ q: `r${tag}` }))).rows.map((row) => row.id)).toEqual([referrer.id]);

    const detail = (await customerDetail(payer.id))!;
    expect(detail).toMatchObject({ password: false, providers: ["google"], referredBy: { id: referrer.id } });
    expect(detail.orders.map((item) => item.provider).sort()).toEqual(["razorpay", "razorpay-test"]);
    expect(JSON.stringify(detail)).not.toContain("secret-token");
    expect(await customerDetail("nobody")).toBeNull();
  });

  it("totals billing by what money moved, and finds an order by its payment id or phone", async () => {
    const filters = orderFilters({ q: tag }, STATES);
    const { totals, count } = await ordersPage(filters);
    expect(count).toBe(3);
    expect(totals).toEqual({
      received: { orders: 1, amount: plan.fee * 100 },
      refunded: { orders: 0, amount: 0 },
      pending: { orders: 1, amount: plan.fee * 100 },
      testMode: { orders: 1, amount: plan.fee * 100 },
      noCharge: { orders: 0, amount: 0 },
    });
    expect((await ordersPage(orderFilters({ q: `pay_${tag}` }, STATES))).rows.map((row) => row.providerPaymentId)).toEqual([`pay_${tag}`]);
    expect((await ordersPage(orderFilters({ q: "98765432", state: "Karnataka" }, STATES))).rows.some((row) => row.providerPaymentId === `pay_${tag}`)).toBe(true);
    expect((await ordersForExport(orderFilters({ q: tag, status: "PENDING" }, STATES))).map((row) => row.status)).toEqual(["PENDING"]);
  });

  it("grants admin by an email's hash, the way the founder's grant does, without the email in the repository", async () => {
    // The real migration names no email (the repository is public); this runs its statement with
    // the hash of a test email instead, to prove the hashing matches: trimmed, lowercased, SHA-256.
    const migration = readFileSync(join(process.cwd(), "prisma/migrations/20261027190000_founder_admin/migration.sql"), "utf8");
    expect(migration).not.toContain("@");
    const statement = migration.replace(/^\s*--.*$/gm, "").trim().replace(/;$/, "");
    const [, hash] = statement.match(/'([0-9a-f]{64})'/) ?? [];
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const email = `Founder-${tag}@Example.Test`;
    const hashed = createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
    const founder = await prisma.user.create({ data: { email, role: "TRADER" } });
    userIds.push(founder.id);
    const other = await user("Other");
    await prisma.$executeRawUnsafe(statement.replace(hash, hashed));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: founder.id } })).isAdmin).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).isAdmin).toBe(false);
  });
});
