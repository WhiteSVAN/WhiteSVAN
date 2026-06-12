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

/**
 * Persist `trades` for one account, then fully rebuild that account's daily
 * rollup from all of its trades. A full rebuild (vs. incremental) keeps the
 * `DailyPnl` table correct even when imports overlap existing dates.
 */
export async function importTrades(
  accountId: string,
  trades: ParsedTrade[],
): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
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

    return { tradeCount: trades.length, tradingDays: daily.length };
  });
}
