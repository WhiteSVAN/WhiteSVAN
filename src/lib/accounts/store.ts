/**
 * Demo (evaluation) and funded accounts in Postgres (server only). The engine's host snapshot is
 * stored whole in `desk`; every change is a read, a pure engine step and a write conditional on
 * `version`, so a platform poll and an order arriving together never overwrite each other. The
 * write that passes an evaluation opens its funded account in the same transaction, unless the
 * trader already has the most funded accounts open: then the pass waits to be activated.
 */
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { staffEmails } from "@/lib/checkout/config";
import { sendFundedAccountEmail, sendPassedWaitingEmail, sendStaffFundedNotice } from "@/lib/email";
import { logger } from "@/lib/logger";
import { findAccountPlan, PROGRAMME_RULES } from "@/lib/prop-firm";
import { deskStep, openDesk, type Desk } from "@/lib/trading/desk";

export interface StoredAccount {
  id: string;
  userId: string;
  planId: string;
  /** EVALUATION: the demo account a trader buys. FUNDED: opened when an evaluation passes. */
  phase: "EVALUATION" | "FUNDED";
  status: "ACTIVE" | "PASSED" | "FAILED";
  /** On a funded account, the evaluation it was opened from. */
  fromAccountId: string | null;
  desk: Desk;
  version: number;
  createdAt: Date;
}

const SELECT = { id: true, userId: true, planId: true, phase: true, status: true, fromAccountId: true, desk: true, version: true, createdAt: true } as const;
type Row = Omit<StoredAccount, "desk"> & { desk: Prisma.JsonValue };
const stored = (row: Row): StoredAccount => ({ ...row, desk: row.desk as unknown as Desk });

/** A new account id: time-ordered, with random bytes so ids can't collide or be guessed. */
export const newAccountId = (now: number) => `ev${now.toString(36)}${randomBytes(6).toString("hex")}`;

export async function listAccounts(userId: string): Promise<StoredAccount[]> {
  const rows = await prisma.evaluationAccount.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: SELECT });
  return rows.map(stored);
}

export async function findAccount(userId: string, id: string): Promise<StoredAccount | null> {
  const row = await prisma.evaluationAccount.findFirst({ where: { id, userId }, select: SELECT });
  return row ? stored(row) : null;
}

export class AccountBusyError extends Error {
  constructor() {
    super("The account is busy. Try again.");
    this.name = "AccountBusyError";
  }
}

/** Serializes the trader's funded-account openings, so two passes at once can't both take the last place. */
async function lockFunding(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`funded-accounts:${userId}`}, 0))`;
}

/**
 * The funded account a passed evaluation opens: the same size, on the plan's current rules. Null
 * while the trader already has the most funded accounts open (prop-firm.ts): the pass then waits in
 * My accounts until one of them ends and the trader activates it (`activateFundedAccount`).
 */
async function openFundedAccount(tx: Prisma.TransactionClient, evaluation: StoredAccount, at: number): Promise<string | null> {
  const plan = findAccountPlan(evaluation.planId);
  if (!plan) throw new Error(`No plan "${evaluation.planId}" for a funded account.`);
  await lockFunding(tx, evaluation.userId);
  const open = await tx.evaluationAccount.count({ where: { userId: evaluation.userId, phase: "FUNDED", status: "ACTIVE" } });
  if (open >= PROGRAMME_RULES.maximumFundedAccounts) return null;
  const id = newAccountId(at);
  await tx.evaluationAccount.create({
    data: { id, userId: evaluation.userId, planId: plan.id, phase: "FUNDED", fromAccountId: evaluation.id, desk: openDesk(plan, id, at, "FUNDED") as unknown as Prisma.InputJsonValue },
  });
  return id;
}

/**
 * After a pass: the trader's "you passed" email and a note to staff to start KYC and the agreement,
 * or, when the funded account waits for a free place, the trader's note that it does. Best effort.
 */
async function announcePass(evaluation: StoredAccount, fundedId: string | null): Promise<void> {
  logger.info(fundedId ? "accounts.funded" : "accounts.funded_waiting", { userId: evaluation.userId, evaluationId: evaluation.id, fundedId });
  try {
    const user = await prisma.user.findUnique({ where: { id: evaluation.userId }, select: { email: true } });
    if (!user?.email) return;
    const planLabel = findAccountPlan(evaluation.planId)?.label ?? evaluation.planId;
    await (fundedId
      ? Promise.all([
          sendFundedAccountEmail(user.email, { planLabel, accountId: fundedId, planId: evaluation.planId }),
          sendStaffFundedNotice(staffEmails(), { traderEmail: user.email, planLabel, planId: evaluation.planId, evaluationId: evaluation.id, accountId: fundedId }),
        ])
      : sendPassedWaitingEmail(user.email, { planLabel, planId: evaluation.planId, evaluationId: evaluation.id, maximum: PROGRAMME_RULES.maximumFundedAccounts }));
  } catch (error) {
    logger.warn("accounts.funded_email_failed", { evaluationId: evaluation.id, fundedId, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Apply a pure change to the account's desk and save it. When another request saved first, the
 * change re-runs on the newer desk. Null when the account isn't this user's.
 */
export async function changeAccount<T>(userId: string, id: string, change: (desk: Desk) => { desk: Desk; result: T }): Promise<{ account: StoredAccount; result: T } | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const account = await findAccount(userId, id);
    if (!account) return null;
    const { desk, result } = change(account.desk);
    const where = { id, userId, version: account.version };
    const data = { desk: desk as unknown as Prisma.InputJsonValue, version: { increment: 1 }, status: desk.state.status, phase: desk.state.phase };
    const passes = account.phase === "EVALUATION" && account.status !== "PASSED" && desk.state.status === "PASSED";
    // The step that passes an evaluation opens its funded account with it, or neither is saved.
    const { saved, fundedId } = passes
      ? await prisma.$transaction(async (tx) => {
          const updated = await tx.evaluationAccount.updateMany({ where, data });
          return { saved: updated.count, fundedId: updated.count === 1 ? await openFundedAccount(tx, account, desk.state.clock) : null };
        })
      : { saved: (await prisma.evaluationAccount.updateMany({ where, data })).count, fundedId: null };
    if (saved !== 1) continue;
    if (passes) await announcePass(account, fundedId);
    return { account: { ...account, desk, status: desk.state.status, version: account.version + 1 }, result };
  }
  throw new AccountBusyError();
}

/**
 * Apply an order while serializing all of the trader's order placements. The callback receives the
 * target and every other active account only after the user lock is held; it is called again after
 * an optimistic write conflict, so policy is never decided from the stale first snapshot.
 */
export async function changeAccountForOrder<T>(
  userId: string,
  id: string,
  change: (account: StoredAccount, others: StoredAccount[]) => { desk: Desk; result: T } | Promise<{ desk: Desk; result: T }>,
): Promise<{ account: StoredAccount; result: T } | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`account-orders:${userId}`}, 0))`;

      const row = await tx.evaluationAccount.findFirst({ where: { id, userId }, select: SELECT });
      if (!row) return { kind: "missing" as const };
      const account = stored(row);
      const otherRows = await tx.evaluationAccount.findMany({
        where: { userId, status: "ACTIVE", id: { not: id } },
        orderBy: { createdAt: "desc" },
        select: SELECT,
      });
      const { desk, result } = await change(account, otherRows.map(stored));
      const where = { id, userId, version: account.version };
      const data = { desk: desk as unknown as Prisma.InputJsonValue, version: { increment: 1 }, status: desk.state.status, phase: desk.state.phase };
      const passes = account.phase === "EVALUATION" && account.status !== "PASSED" && desk.state.status === "PASSED";
      // Keep the funded-account creation in the same transaction as the conditional write.
      const { saved, fundedId } = passes
        ? await (async () => {
            const updated = await tx.evaluationAccount.updateMany({ where, data });
            return { saved: updated.count, fundedId: updated.count === 1 ? await openFundedAccount(tx, account, desk.state.clock) : null };
          })()
        : { saved: (await tx.evaluationAccount.updateMany({ where, data })).count, fundedId: null };
      if (saved !== 1) return { kind: "retry" as const };
      return {
        kind: "saved" as const,
        account: { ...account, desk, status: desk.state.status, version: account.version + 1 },
        result,
        passes,
        fundedId,
      };
    });
    if (outcome.kind === "missing") return null;
    if (outcome.kind === "retry") continue;
    if (outcome.passes) await announcePass(outcome.account, outcome.fundedId);
    return { account: outcome.account, result: outcome.result };
  }
  throw new AccountBusyError();
}

/** Passed evaluations whose funded account hasn't opened yet, because the trader had the most open. */
export function waitingPasses(accounts: readonly StoredAccount[]): Set<string> {
  const opened = new Set(accounts.flatMap((account) => (account.fromAccountId ? [account.fromAccountId] : [])));
  return new Set(accounts.filter((account) => account.phase === "EVALUATION" && account.status === "PASSED" && !opened.has(account.id)).map((account) => account.id));
}

/**
 * Open the funded account a pass was waiting on, once the trader has a free place. The trader's
 * funding lock makes a double press open one account. Null when the account isn't this trader's
 * passed evaluation; "full" while they still have the most funded accounts open.
 */
export async function activateFundedAccount(userId: string, evaluationId: string, now: number): Promise<{ fundedId: string } | "full" | null> {
  const evaluation = await findAccount(userId, evaluationId);
  if (!evaluation || evaluation.phase !== "EVALUATION" || evaluation.status !== "PASSED") return null;
  const outcome = await prisma.$transaction(async (tx) => {
    await lockFunding(tx, userId);
    const opened = await tx.evaluationAccount.findFirst({ where: { userId, fromAccountId: evaluationId }, select: { id: true } });
    if (opened) return { fundedId: opened.id, created: false };
    const fundedId = await openFundedAccount(tx, evaluation, now);
    return fundedId ? { fundedId, created: true } : null;
  });
  if (!outcome) return "full";
  if (outcome.created) await announcePass(evaluation, outcome.fundedId);
  return { fundedId: outcome.fundedId };
}

/** Whether the trading day the desk has open is one `now` closes (the platform was shut before 15:30). */
function closesDay(desk: Desk, now: number): boolean {
  const open = desk.state.day;
  if (!open || open.closed) return false;
  const next = deskStep(desk, { kind: "clock", at: now }, new Map()).desk.state.day;
  return !next || next.date !== open.date || next.closed;
}

/**
 * The trader's accounts, with any trading day nobody closed squared off at its last prices and
 * closed, as the next platform poll would: a pass shows, with its funded account, without waiting
 * for the platform to be opened again.
 */
export async function loadAccounts(userId: string, now: number): Promise<StoredAccount[]> {
  const accounts = await listAccounts(userId);
  const unsettled = accounts.filter((account) => account.status === "ACTIVE" && closesDay(account.desk, now));
  if (unsettled.length === 0) return accounts;
  for (const account of unsettled) {
    await changeAccount(userId, account.id, (desk) => ({ desk: deskStep(desk, { kind: "clock", at: now }, new Map()).desk, result: null }));
  }
  return listAccounts(userId);
}
