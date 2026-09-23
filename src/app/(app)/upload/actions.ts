"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/dal";
import { parseTradesCsv, type ColumnMapping } from "@/lib/csv/parse";
import { parseBrokerCsv } from "@/lib/csv/brokers";
import { DuplicateImportError, OverlappingImportError, importTrades } from "@/lib/ingest/import";
import { sha256 } from "@/lib/hash";

export type AccountFormState =
  | { errors?: { accountName?: string[] }; message?: string }
  | undefined;

/** Create a brokerage or prop-firm account to receive imported trades. */
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

  const account = await prisma.tradingAccount.create({
    data: {
      userId,
      accountName,
      broker: broker || null,
      startingBalance: Number.isFinite(startingBalance) ? startingBalance : 0,
    },
  });

  // Land back on upload with the new account pre-selected.
  redirect(`/upload?account=${account.id}`);
}

export type ImportFormState = { message?: string } | undefined;

/**
 * Re-parse the source file on the server (never trust client-computed numbers)
 * using the user's chosen mapping, then write through the shared import core.
 */
export async function confirmImport(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const userId = await requireUserId();

  const accountId = String(formData.get("accountId") ?? "");
  const csvText = String(formData.get("csvText") ?? "");
  const format = String(formData.get("format") ?? "auto");
  const mappingRaw = String(formData.get("mapping") ?? "{}");

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true, broker: true },
  });
  if (!account) return { message: "Choose an account to load history into." };

  const fileName = String(formData.get("fileName") ?? "").trim() || null;

  // Auto-detect path uses the user's column mapping; broker transaction-export
  // formats (Fidelity, Webull) FIFO-match buys/sells into realized P&L instead.
  let trades;
  if (format === "auto") {
    let mapping: ColumnMapping;
    try {
      mapping = JSON.parse(mappingRaw);
    } catch {
      return { message: "Could not read the column mapping. Try again." };
    }
    trades = parseTradesCsv(csvText, mapping).trades;
  } else {
    trades = parseBrokerCsv(format, csvText).trades;
  }

  if (trades.length === 0) {
    return {
      message:
        format === "auto"
          ? "No valid rows to load — check your column mapping."
          : "No closed trades found to load — check the file matches the selected broker.",
    };
  }

  let result;
  try {
    result = await importTrades(accountId, trades, {
      source: "CSV",
      broker: account.broker,
      originalFilename: fileName,
      fileHash: sha256(csvText),
    });
  } catch (error) {
    if (error instanceof DuplicateImportError) {
      return { message: "This source file was already loaded for this account." };
    }
    if (error instanceof OverlappingImportError) {
      return {
        message: `This file overlaps existing coverage from ${error.periodStart} to ${error.periodEnd}. Clear and replace that account's history, or import a non-overlapping export.`,
      };
    }
    throw error;
  }

  // Freshness is driven by *publishing*, not importing — the trader reviews the
  // new numbers, then clicks Publish on the dashboard to create a profile version.
  redirect(`/dashboard?imported=${result.tradeCount}`);
}
