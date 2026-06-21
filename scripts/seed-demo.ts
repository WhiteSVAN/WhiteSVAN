/**
 * Seed a sanitized demo trader so /p/demo shows a populated research profile.
 * Idempotent: re-running replaces the demo user. Run with: npm run db:seed
 *
 * Uses relative imports only (no `@/` alias) so it runs under plain `tsx`.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { aggregateDaily } from "../src/lib/metrics";
import { computeTrustMetrics } from "../src/lib/trust";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const STARTING_BALANCE = 25000;

// Believable ~8-week daily P&L: a build-up, a mid-period drawdown, recovery,
// and one standout day (some concentration).
const DAILY_PNL = [
  150, 320, -180, 240, 90, 410, -260, 180, 300, -120,
  220, 80, 360, -90, 150, 480, 120, -210, 70, 260,
  -380, -520, -260, -180, 90, -240, 120, 80, 300, 180,
  -120, 420, 1400, 240, -160, 380, 150, 90, 260, 200,
];

function tradingDates(startISO: string, n: number): string[] {
  const dates: string[] = [];
  const d = new Date(`${startISO}T00:00:00Z`);
  while (dates.length < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

const SAMPLE_REPORT = {
  executive_summary:
    "Over the reporting period, the account finished in profit across roughly eight weeks of trading, with consistent daily participation and a mid-period drawdown that was subsequently recovered.",
  performance_summary:
    "The net result was positive on a $25,000 starting base. Winning days outnumbered losing days, with gains concentrated in a handful of stronger sessions.",
  risk_summary:
    "The largest peak-to-trough decline was material and took several sessions to recover. A single day contributed a notable share of total profit, so the results were partly outlier-influenced.",
  discipline_review:
    "Position sizing remained broadly consistent throughout the period. Losing days were, on average, somewhat larger than winning days, which is worth monitoring.",
  notable_days: [
    "The strongest day produced the single largest gain of the period.",
    "The weakest stretch was a short cluster of losing sessions in the middle of the period.",
  ],
  warnings: [
    "A large share of total profit came from a single day.",
    "Losing days were, on average, larger than winning days.",
  ],
  client_disclaimer:
    "This is a historical performance summary provided for informational purposes only. Past performance does not guarantee future results.",
};

async function main() {
  const email = "demo@quantconnect.local";
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      email,
      name: "Ava Demo",
      passwordHash: await bcrypt.hash("demo1234", 10),
      profile: {
        create: {
          displayName: "Ava Demo",
          slug: "demo",
          isPublic: true,
          updateCadence: "WEEKLY",
          strategy: "Intraday futures momentum, risk-defined",
          instruments: "ES, NQ",
          bio: "A demo account showing what a Quant Connect research profile looks like.",
        },
      },
    },
  });

  const account = await prisma.tradingAccount.create({
    data: {
      userId: user.id,
      accountName: "Demo Futures",
      broker: "Demo",
      startingBalance: STARTING_BALANCE,
    },
  });

  const dates = tradingDates("2026-04-06", DAILY_PNL.length);
  const trades = dates.map((date, i) => ({
    accountId: account.id,
    tradeDate: new Date(date),
    symbol: i % 2 === 0 ? "ES" : "NQ",
    assetType: "future",
    side: DAILY_PNL[i] >= 0 ? "LONG" : "SHORT",
    realizedPnl: DAILY_PNL[i],
    fees: 0,
  }));
  await prisma.trade.createMany({ data: trades });

  const daily = aggregateDaily(
    dates.map((date, i) => ({ tradeDate: date, realizedPnl: DAILY_PNL[i], fees: 0 })),
  );
  await prisma.dailyPnl.createMany({
    data: daily.map((d) => ({
      accountId: account.id,
      tradeDate: new Date(d.date),
      grossPnl: d.grossPnl,
      fees: d.fees,
      netPnl: d.netPnl,
      tradeCount: d.tradeCount,
    })),
  });

  const trust = computeTrustMetrics(
    daily.map((d) => ({ date: d.date, netPnl: d.netPnl })),
    STARTING_BALANCE,
    2,
    100,
  );
  const profile = await prisma.traderProfile.findUniqueOrThrow({
    where: { userId: user.id },
    select: { id: true },
  });
  const publishedAt = new Date();
  await prisma.traderProfile.update({
    where: { id: profile.id },
    data: { lastPublishedAt: publishedAt },
  });
  await prisma.profileVersion.create({
    data: {
      profileId: profile.id,
      versionNumber: 1,
      periodStart: new Date(daily[0].date),
      periodEnd: new Date(daily[daily.length - 1].date),
      metrics: JSON.parse(
        JSON.stringify({
          ...trust.metrics,
          bestDayShare: trust.bestDayShare,
          top3Share: trust.top3Share,
          profitWithoutBestDay: trust.profitWithoutBestDay,
          badToGoodRatio: trust.badToGoodRatio,
          drawdownSeverity: trust.drawdownSeverity,
          bounceBackDays: trust.bounceBackDays,
          daysUnderwater: trust.daysUnderwater,
          proofLevel: 2,
          scores: trust.scores,
          verdict: trust.verdict,
        }),
      ),
      netPnl: trust.metrics.netPnl,
      returnPct: trust.metrics.returnPct,
      transparencyScore: trust.scores.transparency,
      proofLevel: 2,
      freshnessStatus: "fresh",
      changeSummary: `First published update — ${trust.metrics.tradingDays} trading days, net $${trust.metrics.netPnl.toFixed(0)}, Transparency Score ${trust.scores.transparency}.`,
      publishedAt,
    },
  });

  await prisma.report.create({
    data: {
      userId: user.id,
      accountId: account.id,
      period: "2026-05",
      metrics: { netPnl: DAILY_PNL.reduce((a, b) => a + b, 0), startingBalance: STARTING_BALANCE },
      aiReport: SAMPLE_REPORT,
      status: "PUBLISHED",
    },
  });

  console.log(`Seeded demo trader → /p/demo (login: ${email} / demo1234)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
