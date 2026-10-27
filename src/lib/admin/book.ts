/**
 * The admin portal's data (server only, read-only): every trader's accounts with their risk now and
 * their quant performance (src/lib/trading/performance.ts), and the audit of every fill and event.
 * Account figures come from each desk's engine state as last saved. Nothing here writes to an
 * account, so one nobody has opened since a day ended shows that day open until its trader's next
 * visit closes it.
 */
import { Prisma, type AccountEventKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { findAccountPlan } from "@/lib/prop-firm";
import { riskMeters, type AccountState, type RiskMeters } from "@/lib/trading/engine";
import type { Paise } from "@/lib/trading/money";
import { dailyReturns, dailyStats, pooledStats, tradeCycles, tradeStats, type CycleFill, type DailyStats, type TradeCycle, type TradeStats } from "@/lib/trading/performance";
import { maxLossFloor } from "@/lib/trading/rules";
import { PAGE_SIZE, istRange, type EventFilters, type FillFilters } from "./filters";

/** An active account this close to a limit is flagged: 75% of the daily loss used, or 25% of the drawdown room left. */
export const NEAR_LIMIT = 0.75;

/** Rankings by a ratio leave out traders with fewer trading days: two days make a Sharpe ratio, not a track record. */
export const RANKING_MIN_DAYS = 5;

/** An account as the portal reads it: the desk's engine state only, not its logs. */
export interface AccountRow {
  id: string;
  userId: string;
  planId: string;
  phase: "EVALUATION" | "FUNDED";
  status: "ACTIVE" | "PASSED" | "FAILED";
  fromAccountId: string | null;
  createdAt: Date;
  state: AccountState;
}

export interface TraderRow {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: Date;
}

export interface BookFill extends CycleFill {
  accountId: string;
}

export interface AdminAccount extends AccountRow {
  planLabel: string;
  meters: RiskMeters;
  /** Today's loss over the daily limit, and the drawdown room left over the max drawdown (0..1). */
  dailyLossShare: number;
  roomShare: number;
  nearLimit: boolean;
  /** A pass whose funded account waits for a free place. */
  waiting: boolean;
  daily: DailyStats;
  trades: TradeStats;
  /** Closed round trips, newest first. */
  cycles: TradeCycle[];
  openTrades: number;
  lastFillAt: number | null;
}

export interface AdminTrader extends TraderRow {
  accounts: AdminAccount[];
  counts: { active: number; funded: number; passed: number; failed: number };
  /** Every account's balance over its starting balance. */
  netPnl: Paise;
  /** The trader's accounts as one book (pooledStats). */
  daily: DailyStats;
  trades: TradeStats;
  lastActivity: number | null;
  nearLimit: boolean;
  /** Orders the trading policy refused, and breaches, ever. */
  refusals: number;
  breaches: number;
}

export interface Book {
  traders: AdminTrader[];
  accounts: AdminAccount[];
}

/** Accounts and traders with their figures (pure). `counts` holds refusals and breaches per trader. */
export function assembleBook(input: { traders: readonly TraderRow[]; accounts: readonly AccountRow[]; fills: readonly BookFill[]; counts: ReadonlyMap<string, { refusals: number; breaches: number }> }): Book {
  const fillsByAccount = new Map<string, BookFill[]>();
  for (const fill of input.fills) fillsByAccount.set(fill.accountId, [...(fillsByAccount.get(fill.accountId) ?? []), fill]);
  const opened = new Set(input.accounts.flatMap((account) => (account.fromAccountId ? [account.fromAccountId] : [])));
  const accounts = input.accounts.map((row): AdminAccount => {
    const meters = riskMeters(row.state);
    const { rules } = row.state;
    const active = row.status === "ACTIVE";
    const dailyLossShare = active && rules.dailyLoss > 0 ? meters.dailyLossUsed / rules.dailyLoss : 0;
    const roomShare = rules.maxLoss > 0 ? Math.max(0, Math.min(1, meters.roomToFloor / rules.maxLoss)) : 1;
    const fills = fillsByAccount.get(row.id) ?? [];
    const { closed, open } = tradeCycles(fills);
    return {
      ...row,
      planLabel: findAccountPlan(row.planId)?.label ?? row.planId,
      meters,
      dailyLossShare,
      roomShare,
      nearLimit: active && (dailyLossShare >= NEAR_LIMIT || roomShare <= 1 - NEAR_LIMIT),
      waiting: row.phase === "EVALUATION" && row.status === "PASSED" && !opened.has(row.id),
      daily: dailyStats(rules.startingBalance, row.state.days),
      trades: tradeStats(closed),
      cycles: [...closed].reverse(),
      openTrades: open.length,
      lastFillAt: fills.length ? Math.max(...fills.map((fill) => fill.at)) : null,
    };
  });
  const byTrader = new Map<string, AdminAccount[]>();
  for (const account of accounts) byTrader.set(account.userId, [...(byTrader.get(account.userId) ?? []), account]);
  const traders = input.traders.map((row): AdminTrader => {
    const own = byTrader.get(row.id) ?? [];
    const activity = own.flatMap((account) => (account.lastFillAt === null ? [] : [account.lastFillAt]));
    return {
      ...row,
      accounts: own,
      counts: {
        active: own.filter((account) => account.phase === "EVALUATION" && account.status === "ACTIVE").length,
        funded: own.filter((account) => account.phase === "FUNDED" && account.status === "ACTIVE").length,
        passed: own.filter((account) => account.phase === "EVALUATION" && account.status === "PASSED").length,
        failed: own.filter((account) => account.status === "FAILED").length,
      },
      netPnl: own.reduce((sum, account) => sum + account.meters.balance - account.state.rules.startingBalance, 0),
      daily: pooledStats(own.map((account) => ({ startingBalance: account.state.rules.startingBalance, days: account.state.days }))),
      trades: tradeStats(own.flatMap((account) => account.cycles)),
      lastActivity: activity.length ? Math.max(...activity) : null,
      nearLimit: own.some((account) => account.nearLimit),
      refusals: input.counts.get(row.id)?.refusals ?? 0,
      breaches: input.counts.get(row.id)?.breaches ?? 0,
    };
  });
  return { traders, accounts };
}

/** One account's closing balance and drawdown floor after each closed day, for its chart and table. */
export function balanceHistory(state: AccountState) {
  let high = state.rules.startingBalance;
  return dailyReturns(state.rules.startingBalance, state.days).map((day) => {
    high = Math.max(high, day.closing);
    return { ...day, floor: maxLossFloor(state.rules, high) };
  });
}

/** Closed days' net P&L summed by date across accounts, oldest first. */
export function pooledDays(accounts: readonly { state: AccountState }[]): { date: string; net: Paise }[] {
  const byDate = new Map<string, Paise>();
  for (const account of accounts) for (const day of account.state.days) byDate.set(day.date, (byDate.get(day.date) ?? 0) + day.net);
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, net]) => ({ date, net }));
}

type RawAccount = Omit<AccountRow, "state"> & { state: AccountState };

/** The book, or the part of it for one trader or one account. */
export async function loadBook(scope: { userId?: string; accountId?: string } = {}): Promise<Book> {
  const where = scope.accountId ? Prisma.sql`WHERE a."id" = ${scope.accountId}` : scope.userId ? Prisma.sql`WHERE a."userId" = ${scope.userId}` : Prisma.empty;
  // Only the engine state: the desk's fill, order and activity logs aren't needed here.
  const accounts = await prisma.$queryRaw<RawAccount[]>`
    SELECT a."id", a."userId", a."planId", a."phase"::text AS "phase", a."status"::text AS "status", a."fromAccountId", a."createdAt", a."desk"->'state' AS "state"
    FROM "EvaluationAccount" a ${where}
    ORDER BY a."createdAt" DESC`;
  const userIds = [...new Set(accounts.map((account) => account.userId))];
  const fillWhere = scope.accountId ? { accountId: scope.accountId } : scope.userId ? { userId: scope.userId } : {};
  const [traders, fills, counts] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.accountFill.findMany({ where: fillWhere, select: { accountId: true, fillId: true, token: true, tradingSymbol: true, side: true, quantity: true, realised: true, chargesTotal: true, at: true } }),
    prisma.accountEvent.groupBy({ by: ["userId", "kind"], where: { userId: { in: userIds }, kind: { in: ["ORDER_REFUSED", "BREACH"] } }, _count: { _all: true } }),
  ]);
  const tally = new Map<string, { refusals: number; breaches: number }>();
  for (const row of counts) {
    const seen = tally.get(row.userId) ?? { refusals: 0, breaches: 0 };
    tally.set(row.userId, row.kind === "BREACH" ? { ...seen, breaches: row._count._all } : { ...seen, refusals: row._count._all });
  }
  return assembleBook({
    traders,
    accounts,
    fills: fills.map((fill) => ({ accountId: fill.accountId, id: fill.fillId, token: fill.token, tradingSymbol: fill.tradingSymbol, side: fill.side === "SELL" ? "SELL" : "BUY", quantity: fill.quantity, realised: fill.realised, charges: fill.chargesTotal, at: fill.at.getTime() })),
    counts: tally,
  });
}

const traderMatch = (q: string | undefined): Prisma.UserWhereInput | undefined =>
  q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : undefined;

export function fillWhere(filters: FillFilters): Prisma.AccountFillWhereInput {
  return {
    ...(filters.from || filters.to ? { at: istRange(filters.from, filters.to) } : {}),
    ...(filters.q ? { user: traderMatch(filters.q) } : {}),
    ...(filters.account ? { accountId: filters.account } : {}),
    ...(filters.symbol ? { tradingSymbol: { contains: filters.symbol, mode: "insensitive" } } : {}),
    ...(filters.side ? { side: filters.side } : {}),
    ...(filters.reason ? { reason: filters.reason } : {}),
  };
}

const FILL_SELECT = {
  id: true, fillId: true, orderId: true, reason: true, tradingSymbol: true, side: true, quantity: true, price: true, realised: true, charges: true, chargesTotal: true, balanceAfter: true, at: true, accountId: true,
  account: { select: { planId: true, phase: true } },
  user: { select: { id: true, email: true, name: true } },
} satisfies Prisma.AccountFillSelect;

export type FillLine = Prisma.AccountFillGetPayload<{ select: typeof FILL_SELECT }>;

/** One page of fills, newest first, and totals over every fill the filters match. */
export async function fillsPage(filters: FillFilters) {
  const where = fillWhere(filters);
  const [rows, totals] = await Promise.all([
    prisma.accountFill.findMany({ where, select: FILL_SELECT, orderBy: [{ at: "desc" }, { id: "desc" }], skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.accountFill.aggregate({ where, _count: { _all: true }, _sum: { realised: true, chargesTotal: true } }),
  ]);
  return { rows, count: totals._count._all, realised: totals._sum.realised ?? 0, charges: totals._sum.chargesTotal ?? 0 };
}

/** Every fill the filters match, oldest first, for the CSV export (capped). */
export async function fillsForExport(filters: FillFilters, cap = 50_000): Promise<FillLine[]> {
  return prisma.accountFill.findMany({ where: fillWhere(filters), select: FILL_SELECT, orderBy: [{ at: "asc" }, { id: "asc" }], take: cap });
}

const EVENT_SELECT = {
  id: true, kind: true, orderId: true, at: true, detail: true, accountId: true,
  account: { select: { planId: true, phase: true } },
  user: { select: { id: true, email: true, name: true } },
} satisfies Prisma.AccountEventSelect;

export type EventLine = Prisma.AccountEventGetPayload<{ select: typeof EVENT_SELECT }>;

export function eventWhere(filters: EventFilters, kinds?: readonly AccountEventKind[]): Prisma.AccountEventWhereInput {
  return {
    ...(filters.from || filters.to ? { at: istRange(filters.from, filters.to) } : {}),
    ...(filters.q ? { user: traderMatch(filters.q) } : {}),
    ...(filters.account ? { accountId: filters.account } : {}),
    ...(filters.kind ? { kind: filters.kind } : kinds ? { kind: { in: [...kinds] } } : {}),
  };
}

/** One page of audit events, newest first. */
export async function eventsPage(filters: EventFilters) {
  const where = eventWhere(filters);
  const [rows, count] = await Promise.all([
    prisma.accountEvent.findMany({ where, select: EVENT_SELECT, orderBy: [{ at: "desc" }, { id: "desc" }], skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.accountEvent.count({ where }),
  ]);
  return { rows, count };
}

/** The latest events, optionally of some kinds or since a time. */
export async function latestEvents(options: { take: number; kinds?: readonly AccountEventKind[]; since?: Date; userId?: string; accountId?: string }): Promise<EventLine[]> {
  return prisma.accountEvent.findMany({
    where: {
      ...(options.kinds ? { kind: { in: [...options.kinds] } } : {}),
      ...(options.since ? { at: { gte: options.since } } : {}),
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.accountId ? { accountId: options.accountId } : {}),
    },
    select: EVENT_SELECT,
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: options.take,
  });
}

/** Fills and the traders who made them on one IST date. */
export async function dayActivity(date: string) {
  const where = { at: istRange(date, date) };
  const [fills, traders] = await Promise.all([
    prisma.accountFill.aggregate({ where, _count: { _all: true }, _sum: { chargesTotal: true } }),
    prisma.accountFill.groupBy({ by: ["userId"], where }),
  ]);
  return { fills: fills._count._all, charges: fills._sum.chargesTotal ?? 0, traders: traders.length };
}

/** The latest fills of one account or trader, newest first. */
export async function latestFills(options: { take: number; userId?: string; accountId?: string }): Promise<FillLine[]> {
  return prisma.accountFill.findMany({
    where: { ...(options.userId ? { userId: options.userId } : {}), ...(options.accountId ? { accountId: options.accountId } : {}) },
    select: FILL_SELECT,
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: options.take,
  });
}
