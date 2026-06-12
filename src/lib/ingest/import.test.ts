/**
 * Integration test for the import core — runs against the dev Postgres.
 * Skips automatically when DATABASE_URL is unset (e.g. CI without a DB).
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { importTrades } from "@/lib/ingest/import";
import type { ParsedTrade } from "@/lib/csv/parse";

const hasDb = !!process.env.DATABASE_URL;

const trade = (over: Partial<ParsedTrade>): ParsedTrade => ({
  tradeDate: "2026-05-01",
  symbol: "ES",
  realizedPnl: 0,
  fees: 0,
  raw: {},
  ...over,
});

describe.skipIf(!hasDb)("importTrades (integration)", () => {
  let userId = "";

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("writes trades and rebuilds the daily rollup", async () => {
    const user = await prisma.user.create({ data: { email: `test+${Date.now()}@example.com` } });
    userId = user.id;
    const account = await prisma.tradingAccount.create({
      data: { userId, accountName: "Test", startingBalance: 10000 },
    });

    const result = await importTrades(account.id, [
      trade({ tradeDate: "2026-05-01", realizedPnl: 100, fees: 2 }),
      trade({ tradeDate: "2026-05-01", realizedPnl: 50, fees: 2 }),
      trade({ tradeDate: "2026-05-02", realizedPnl: -40, fees: 2 }),
    ]);

    expect(result.tradeCount).toBe(3);
    expect(result.tradingDays).toBe(2);

    const days = await prisma.dailyPnl.findMany({
      where: { accountId: account.id },
      orderBy: { tradeDate: "asc" },
    });
    expect(days).toHaveLength(2);
    // Day 1: gross 150, fees 4 → net 146 across 2 trades.
    expect(Number(days[0].netPnl)).toBeCloseTo(146);
    expect(days[0].tradeCount).toBe(2);
    // Day 2: net -42.
    expect(Number(days[1].netPnl)).toBeCloseTo(-42);

    expect(await prisma.trade.count({ where: { accountId: account.id } })).toBe(3);
  });

  it("rebuilds (does not duplicate) the rollup on a second import", async () => {
    const account = await prisma.tradingAccount.findFirstOrThrow({ where: { userId } });
    await importTrades(account.id, [trade({ tradeDate: "2026-05-02", realizedPnl: 10, fees: 0 })]);

    const day2 = await prisma.dailyPnl.findFirstOrThrow({
      where: { accountId: account.id, tradeDate: new Date("2026-05-02") },
    });
    // Original -42 plus the new +10 → -32, still a single row for the day.
    expect(Number(day2.netPnl)).toBeCloseTo(-32);
    expect(day2.tradeCount).toBe(2);
  });
});
