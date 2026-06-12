"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/dal";
import { parseTradesCsv, type ColumnMapping } from "@/lib/csv/parse";
import { importTrades } from "@/lib/ingest/import";

export type AccountFormState =
  | { errors?: { accountName?: string[] }; message?: string }
  | undefined;

/** Create a brokerage/prop-firm account to import trades into. */
export async function createAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const userId = await requireUserId();

  const accountName = String(formData.get("accountName") ?? "").trim();
  const broker = String(formData.get("broker") ?? "").trim();
  const startingBalance = Number(formData.get("startingBalance") ?? 0);

  if (accountName.length < 1) {
    return { errors: { accountName: ["Give this account a name."] } };
  }

  await prisma.tradingAccount.create({
    data: {
      userId,
      accountName,
      broker: broker || null,
      startingBalance: Number.isFinite(startingBalance) ? startingBalance : 0,
    },
  });

  redirect("/upload");
}

export type ImportFormState = { message?: string } | undefined;

/**
 * Re-parse the CSV on the server (never trust client-computed numbers) using
 * the user's chosen mapping, then write through the shared import core.
 */
export async function confirmImport(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const userId = await requireUserId();

  const accountId = String(formData.get("accountId") ?? "");
  const csvText = String(formData.get("csvText") ?? "");
  const mappingRaw = String(formData.get("mapping") ?? "{}");

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) return { message: "Choose an account to import into." };

  let mapping: ColumnMapping;
  try {
    mapping = JSON.parse(mappingRaw);
  } catch {
    return { message: "Could not read the column mapping. Try again." };
  }

  const { trades } = parseTradesCsv(csvText, mapping);
  if (trades.length === 0) {
    return { message: "No valid rows to import — check your column mapping." };
  }

  const result = await importTrades(accountId, trades);
  redirect(`/dashboard?imported=${result.tradeCount}`);
}
