/**
 * Evaluation accounts in Postgres (server only). The engine's host snapshot is stored whole in
 * `desk`; every change is a read, a pure engine step and a write conditional on `version`, so a
 * platform poll and an order arriving together never overwrite each other.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Desk } from "@/lib/trading/desk";

export interface StoredAccount {
  id: string;
  userId: string;
  planId: string;
  status: "ACTIVE" | "PASSED" | "FAILED";
  desk: Desk;
  version: number;
  createdAt: Date;
}

const SELECT = { id: true, userId: true, planId: true, status: true, desk: true, version: true, createdAt: true } as const;
type Row = { id: string; userId: string; planId: string; status: StoredAccount["status"]; desk: Prisma.JsonValue; version: number; createdAt: Date };
const stored = (row: Row): StoredAccount => ({ ...row, desk: row.desk as unknown as Desk });

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

/**
 * Apply a pure change to the account's desk and save it. When another request saved first, the
 * change re-runs on the newer desk. Null when the account isn't this user's.
 */
export async function changeAccount<T>(userId: string, id: string, change: (desk: Desk) => { desk: Desk; result: T }): Promise<{ account: StoredAccount; result: T } | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const account = await findAccount(userId, id);
    if (!account) return null;
    const { desk, result } = change(account.desk);
    const saved = await prisma.evaluationAccount.updateMany({
      where: { id, userId, version: account.version },
      data: { desk: desk as unknown as Prisma.InputJsonValue, version: { increment: 1 }, status: desk.state.status, phase: desk.state.phase },
    });
    if (saved.count === 1) return { account: { ...account, desk, status: desk.state.status, version: account.version + 1 }, result };
  }
  throw new AccountBusyError();
}
