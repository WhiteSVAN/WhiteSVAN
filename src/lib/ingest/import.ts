/**
 * Source-agnostic trade import.
 *
 * Any ingestion source (CSV today, an IBKR Flex Web Service adapter tomorrow)
 * normalizes to `ParsedTrade[]` and hands off to `importTrades`. This is the
 * single write path into `Trade` + `DailyPnl`, so the rollup stays consistent
 * regardless of where the trades came from.
 */
import type { ParsedTrade } from "@/lib/csv/parse";
import { aggregateDaily } from "@/lib/metrics";
import { toISODate } from "@/lib/format";
import { prisma } from "@/lib/db";

export interface ImportResult {
  tradeCount: number;
  tradingDays: number;
}

/** Provenance for the import, recorded as an `ImportBatch` audit row (MVP2). */
export interface ImportSourceInfo {
  source?: "CSV" | "MANUAL" | "STATEMENT" | "BROKER_API";
  broker?: string | null;
  originalFilename?: string | null;
  /** sha-256 of the raw file text (see src/lib/hash.ts). */
  fileHash: string;
}

export class DuplicateImportError extends Error {
  constructor() {
    super("This file was already imported for this account.");
    this.name = "DuplicateImportError";
  }
}

export class OverlappingImportError extends Error {
  constructor(public readonly periodStart: string, public readonly periodEnd: string) {
    super(`This export overlaps existing imported coverage (${periodStart} to ${periodEnd}).`);
    this.name = "OverlappingImportError";
  }
}

/**
 * Persist `trades` for one account, then fully rebuild that account's daily
 * rollup from all of its trades. A full rebuild (vs. incremental) keeps the
 * `DailyPnl` table correct even when imports overlap existing dates.
 *
 * When `sourceInfo` is given, an `ImportBatch` audit row is written in the same
 * transaction (file hash, row count, period, net P&L this import contributed).
 */
export async function importTrades(
  accountId: string,
  trades: ParsedTrade[],
  sourceInfo?: ImportSourceInfo,
): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    if (sourceInfo) {
      const existing = await tx.importBatch.findFirst({
        where: { accountId, fileHash: sourceInfo.fileHash },
        select: { id: true },
      });
      if (existing) throw new DuplicateImportError();

      if (trades.length > 0) {
        const dates = trades.map((trade) => trade.tradeDate).sort();
        const periodStart = dates[0];
        const periodEnd = dates[dates.length - 1];
        const overlap = await tx.importBatch.findFirst({
          where: {
            accountId,
            periodStart: { lte: new Date(periodEnd) },
            periodEnd: { gte: new Date(periodStart) },
          },
          select: { periodStart: true, periodEnd: true },
          orderBy: { createdAt: "desc" },
        });
        if (overlap?.periodStart && overlap.periodEnd) {
          throw new OverlappingImportError(
            toISODate(overlap.periodStart),
            toISODate(overlap.periodEnd),
          );
        }
      }
    }

    if (trades.length > 0) {
      await tx.trade.createMany({
        data: trades.map((t) => ({
          accountId,
          tradeDate: new Date(t.tradeDate),
          symbol: t.symbol,
          assetType: t.assetType ?? null,
          side: t.side ?? null,
          quantity: t.quantity ?? null,
          entryPrice: t.entryPrice ?? null,
          exitPrice: t.exitPrice ?? null,
          realizedPnl: t.realizedPnl,
          fees: t.fees,
          raw: t.raw,
        })),
      });
    }

    const all = await tx.trade.findMany({
      where: { accountId },
      select: { tradeDate: true, realizedPnl: true, fees: true },
    });

    const daily = aggregateDaily(
      all.map((t) => ({
        tradeDate: toISODate(t.tradeDate),
        realizedPnl: Number(t.realizedPnl),
        fees: Number(t.fees),
      })),
    );

    await tx.dailyPnl.deleteMany({ where: { accountId } });
    if (daily.length > 0) {
      await tx.dailyPnl.createMany({
        data: daily.map((d) => ({
          accountId,
          tradeDate: new Date(d.date),
          grossPnl: d.grossPnl,
          fees: d.fees,
          netPnl: d.netPnl,
          tradeCount: d.tradeCount,
        })),
      });
    }

    // Audit row for this import (period + net P&L summarize *this* file's trades).
    if (sourceInfo && trades.length > 0) {
      const dates = trades.map((t) => t.tradeDate).sort();
      const netPnl = trades.reduce((sum, t) => sum + t.realizedPnl - (t.fees ?? 0), 0);
      await tx.importBatch.create({
        data: {
          accountId,
          source: sourceInfo.source ?? "CSV",
          broker: sourceInfo.broker ?? null,
          originalFilename: sourceInfo.originalFilename ?? null,
          fileHash: sourceInfo.fileHash,
          rowCount: trades.length,
          periodStart: new Date(dates[0]),
          periodEnd: new Date(dates[dates.length - 1]),
          netPnl,
        },
      });
    }

    return { tradeCount: trades.length, tradingDays: daily.length };
  });
}
