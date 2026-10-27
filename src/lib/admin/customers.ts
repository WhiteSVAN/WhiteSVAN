/**
 * Customers and billing for the admin portal (server only, read-only): every signed-up user with
 * how they sign in, who referred them, their orders and accounts, and every checkout order. Password
 * hashes, OAuth tokens and sessions are never read: a sign-in method is known by what exists, not
 * by loading it. Only a captured live Razorpay payment counts as money received.
 */
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Paise } from "@/lib/trading/money";
import { PAGE_SIZE, istRange, type CustomerFilters, type OrderFilters } from "./filters";

export const PROVIDER_LABELS: Record<string, string> = {
  razorpay: "Razorpay",
  "razorpay-test": "Razorpay test mode",
  test: "Staff test",
  free: "Free start",
  demo: "Virtual credit (legacy)",
};

/** An order's state in words that never claim a payment that didn't happen. */
export function orderStateLabel(provider: string, status: OrderStatus): string {
  if (status === "PENDING") return "Awaiting payment";
  if (status === "FAILED") return "Failed";
  if (status === "REFUNDED") return "Refunded";
  if (provider === "razorpay") return "Paid";
  if (provider === "razorpay-test") return "Paid in test mode, no money";
  return "Opened, no charge";
}

/** Money actually received: a captured live Razorpay payment that hasn't been refunded. */
export const moneyReceived = (order: { provider: string; status: OrderStatus }) => order.provider === "razorpay" && order.status === "PAID";

const PERSON = { id: true, email: true, name: true } as const;

export interface AccountCounts {
  total: number;
  active: number;
  funded: number;
  passed: number;
  failed: number;
}

export interface CustomerRow {
  id: string;
  email: string | null;
  name: string | null;
  joined: Date;
  role: string | null;
  isAdmin: boolean;
  password: boolean;
  google: boolean;
  referralCode: string | null;
  referredBy: { id: string; email: string | null; name: string | null } | null;
  referrals: number;
  accounts: AccountCounts;
  orders: number;
  /** Paise received through live Razorpay. */
  received: Paise;
  lastOrderAt: Date | null;
}

export function customerWhere(filters: CustomerFilters): Prisma.UserWhereInput {
  return {
    ...(filters.from || filters.to ? { createdAt: istRange(filters.from, filters.to) } : {}),
    ...(filters.q ? { OR: [{ email: { contains: filters.q, mode: "insensitive" } }, { name: { contains: filters.q, mode: "insensitive" } }, { referralCode: { equals: filters.q, mode: "insensitive" } }] } : {}),
    ...(filters.show === "paying" ? { checkoutOrders: { some: { provider: "razorpay", status: "PAID" } } } : {}),
    ...(filters.show === "traders" ? { evaluationAccounts: { some: {} } } : {}),
    ...(filters.show === "none" ? { evaluationAccounts: { none: {} } } : {}),
    ...(filters.show === "admins" ? { isAdmin: true } : {}),
  };
}

/** Per user: accounts by phase and status, orders, money received and the last order, and who has a password. */
async function customerTallies(ids: readonly string[]) {
  const [withPassword, accountGroups, orderGroups] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...ids] }, passwordHash: { not: null } }, select: { id: true } }),
    prisma.evaluationAccount.groupBy({ by: ["userId", "phase", "status"], where: { userId: { in: [...ids] } }, _count: { _all: true } }),
    prisma.checkoutOrder.groupBy({ by: ["userId", "provider", "status"], where: { userId: { in: [...ids] } }, _count: { _all: true }, _sum: { amount: true }, _max: { createdAt: true } }),
  ]);
  const accounts = new Map<string, AccountCounts>();
  for (const group of accountGroups) {
    const seen = accounts.get(group.userId) ?? { total: 0, active: 0, funded: 0, passed: 0, failed: 0 };
    const count = group._count._all;
    seen.total += count;
    if (group.status === "ACTIVE") seen[group.phase === "FUNDED" ? "funded" : "active"] += count;
    else if (group.status === "PASSED") seen.passed += count;
    else seen.failed += count;
    accounts.set(group.userId, seen);
  }
  const orders = new Map<string, { orders: number; received: Paise; lastOrderAt: Date | null }>();
  for (const group of orderGroups) {
    const seen = orders.get(group.userId) ?? { orders: 0, received: 0, lastOrderAt: null };
    seen.orders += group._count._all;
    if (moneyReceived(group)) seen.received += group._sum.amount ?? 0;
    const last = group._max.createdAt;
    if (last && (!seen.lastOrderAt || last > seen.lastOrderAt)) seen.lastOrderAt = last;
    orders.set(group.userId, seen);
  }
  return { password: new Set(withPassword.map((user) => user.id)), accounts, orders };
}

/** One page of customers, newest first. */
export async function customersPage(filters: CustomerFilters): Promise<{ rows: CustomerRow[]; count: number }> {
  const where = customerWhere(filters);
  const [users, count] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { ...PERSON, createdAt: true, role: true, isAdmin: true, referralCode: true, referredBy: { select: PERSON }, accounts: { where: { provider: "google" }, select: { provider: true } }, _count: { select: { referrals: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);
  const tallies = await customerTallies(users.map((user) => user.id));
  return {
    count,
    rows: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      joined: user.createdAt,
      role: user.role,
      isAdmin: user.isAdmin,
      password: tallies.password.has(user.id),
      google: user.accounts.length > 0,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      referrals: user._count.referrals,
      accounts: tallies.accounts.get(user.id) ?? { total: 0, active: 0, funded: 0, passed: 0, failed: 0 },
      ...(tallies.orders.get(user.id) ?? { orders: 0, received: 0, lastOrderAt: null }),
    })),
  };
}

/** Everything the firm holds on one customer, but credentials: profile, sign-in, referrals, orders and journal notes. */
export async function customerDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...PERSON,
      createdAt: true,
      role: true,
      isAdmin: true,
      emailVerified: true,
      referralCode: true,
      referredBy: { select: PERSON },
      referrals: { select: { ...PERSON, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 },
      accounts: { select: { provider: true } },
      _count: { select: { referrals: true } },
    },
  });
  if (!user) return null;
  const [withPassword, orders, notes] = await Promise.all([
    prisma.user.count({ where: { id: userId, passwordHash: { not: null } } }),
    prisma.checkoutOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { account: { select: { id: true, planId: true } } } }),
    prisma.journalNote.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 60, select: { date: true, text: true, updatedAt: true } }),
  ]);
  return { ...user, password: withPassword > 0, providers: [...new Set(user.accounts.map((account) => account.provider))], orders, notes };
}

export function orderWhere(filters: OrderFilters): Prisma.CheckoutOrderWhereInput {
  const q = filters.q;
  return {
    ...(filters.from || filters.to ? { createdAt: istRange(filters.from, filters.to) } : {}),
    ...(q
      ? {
          OR: [
            { user: { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } },
            { billingEmail: { contains: q, mode: "insensitive" } },
            { billingName: { contains: q, mode: "insensitive" } },
            { billingPhone: { contains: q } },
            { id: q },
            { providerOrderId: q },
            { providerPaymentId: q },
          ],
        }
      : {}),
    ...(filters.account ? { accountId: filters.account } : {}),
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.state ? { billingState: filters.state } : {}),
  };
}

const ORDER_INCLUDE = { user: { select: PERSON }, account: { select: { id: true, planId: true, phase: true, status: true } } } satisfies Prisma.CheckoutOrderInclude;

export type OrderLine = Prisma.CheckoutOrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/** One page of orders, newest first, and totals by provider and status over every order the filters match. */
export async function ordersPage(filters: OrderFilters) {
  const where = orderWhere(filters);
  const [rows, count, groups] = await Promise.all([
    prisma.checkoutOrder.findMany({ where, include: ORDER_INCLUDE, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.checkoutOrder.count({ where }),
    prisma.checkoutOrder.groupBy({ by: ["provider", "status"], where, _count: { _all: true }, _sum: { amount: true } }),
  ]);
  const sum = (match: (group: (typeof groups)[number]) => boolean) => groups.filter(match).reduce((total, group) => ({ orders: total.orders + group._count._all, amount: total.amount + (group._sum.amount ?? 0) }), { orders: 0, amount: 0 });
  return {
    rows,
    count,
    totals: {
      received: sum((group) => moneyReceived(group)),
      refunded: sum((group) => group.provider === "razorpay" && group.status === "REFUNDED"),
      pending: sum((group) => group.status === "PENDING"),
      testMode: sum((group) => group.provider === "razorpay-test" && group.status === "PAID"),
      noCharge: sum((group) => (group.provider === "free" || group.provider === "test" || group.provider === "demo") && group.status === "PAID"),
    },
  };
}

/** Every order the filters match, oldest first, for the CSV export (capped). */
export async function ordersForExport(filters: OrderFilters, cap = 50_000): Promise<OrderLine[]> {
  return prisma.checkoutOrder.findMany({ where: orderWhere(filters), include: ORDER_INCLUDE, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: cap });
}

/** Signed-up users, and money received through live Razorpay, for the overview. */
export async function customerTotals() {
  const [customers, received] = await Promise.all([
    prisma.user.count(),
    prisma.checkoutOrder.aggregate({ where: { provider: "razorpay", status: "PAID" }, _count: { _all: true }, _sum: { amount: true } }),
  ]);
  return { customers, receivedOrders: received._count._all, received: received._sum.amount ?? 0 };
}
