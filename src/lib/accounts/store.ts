/**
 * Demo (evaluation) and funded accounts in Postgres (server only). The engine's host snapshot is
 * stored whole in `desk`; every change is a read, a pure engine step and a write conditional on
 * `version`, so a platform poll and an order arriving together never overwrite each other. The
 * write that passes an evaluation opens its funded account in the same transaction.
 */
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { staffEmails } from "@/lib/checkout/config";
import { sendFundedAccountEmail, sendStaffFundedNotice } from "@/lib/email";
import { logger } from "@/lib/logger";
import { findAccountPlan } from "@/lib/prop-firm";
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

/** The funded account a passed evaluation opens: the same size, on the plan's current rules. */
async function openFundedAccount(tx: Prisma.TransactionClient, evaluation: StoredAccount, at: number): Promise<string> {
  const plan = findAccountPlan(evaluation.planId);
  if (!plan) throw new Error(`No plan "${evaluation.planId}" for a funded account.`);
  const id = newAccountId(at);
  await tx.evaluationAccount.create({
    data: { id, userId: evaluation.userId, planId: plan.id, phase: "FUNDED", fromAccountId: evaluation.id, desk: openDesk(plan, id, at, "FUNDED") as unknown as Prisma.InputJsonValue },
  });
  return id;
}

/** The trader's "you passed" email, and a note to staff to start KYC and the agreement. */
async function announceFunded(evaluation: StoredAccount, fundedId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: evaluation.userId }, select: { email: true } });
  if (!user?.email) return;
  const planLabel = findAccountPlan(evaluation.planId)?.label ?? evaluation.planId;
  await Promise.all([
    sendFundedAccountEmail(user.email, { planLabel, accountId: fundedId, planId: evaluation.planId }),
    sendStaffFundedNotice(staffEmails(), { traderEmail: user.email, planLabel, planId: evaluation.planId, evaluationId: evaluation.id, accountId: fundedId }),
  ]);
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
    if (fundedId) {
      logger.info("accounts.funded", { userId, evaluationId: id, fundedId });
      await announceFunded(account, fundedId).catch((error: unknown) => {
        logger.warn("accounts.funded_email_failed", { fundedId, error: error instanceof Error ? error.message : String(error) });
      });
    }
    return { account: { ...account, desk, status: desk.state.status, version: account.version + 1 }, result };
  }
  throw new AccountBusyError();
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
