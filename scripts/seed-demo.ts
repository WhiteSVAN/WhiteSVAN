/**
 * Seed sanitized demo traders so /explore, /network, and /p/demo feel populated.
 * Idempotent: re-running replaces these demo users. Run with: npm run db:seed
 *
 * Uses relative imports only (no `@/` alias) so it runs under plain `tsx`.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { saveEvidenceFile, deleteEvidenceFile } from "../src/lib/evidence";
import { aggregateDaily } from "../src/lib/metrics";
import { computeTrustMetrics, type ProofLevel } from "../src/lib/trust";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type EvidenceSeed = {
  kind: "STATEMENT" | "TAX_RETURN";
  label: string;
  originalName: string;
  isPublic: boolean;
  accountScoped: boolean;
};

type RiskEventSeed = {
  type:
    | "DRAWDOWN"
    | "WORST_DAY"
    | "BIG_WIN_DEPENDENCY"
    | "LOSS_VS_WIN"
    | "SCORE_CHANGE"
    | "RECOVERY";
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description: string;
  metricAfter?: number;
};

type ReportSeed = {
  executive_summary: string;
  performance_summary: string;
  risk_summary: string;
  discipline_review: string;
  notable_days: string[];
  warnings: string[];
  client_disclaimer: string;
};

type SeedTrader = {
  email: string;
  password?: string;
  name: string;
  slug: string;
  headline: string;
  strategy: string;
  instruments: string;
  bio: string;
  services?: string;
  contactUrl?: string;
  openToWork: boolean;
  updateCadence: "DAILY" | "WEEKLY" | "MONTHLY";
  accountName: string;
  broker: string;
  startingBalance: number;
  startDate: string;
  dailyPnl: number[];
  symbols: string[];
  proofLevel: ProofLevel;
  updateReliability: number;
  reportPeriod: string;
  report: ReportSeed;
  evidence: EvidenceSeed[];
  riskEvents: RiskEventSeed[];
};

const DISCLAIMER =
  "This is a historical performance summary provided for informational purposes only. Past performance does not guarantee future results.";

const SEED_TRADERS: SeedTrader[] = [
  {
    email: "demo@quantidive.local",
    password: "demo1234",
    name: "Ava Rao",
    slug: "demo",
    headline: "Proof L4 futures operator - GEX and intraday risk",
    strategy: "Systematic futures momentum with SPX gamma context",
    instruments: "ES, NQ, SPX options",
    bio: "Ava runs a rules-led futures process that combines opening-range structure, volatility context, and strict daily loss limits. This seeded profile shows how a verified Quantidive operator page should read.",
    services: "Market-structure research, futures execution review, and risk-process consulting for prop desks and independent operators.",
    contactUrl: "https://cal.com/quantidive/ava-rao-demo",
    openToWork: true,
    updateCadence: "WEEKLY",
    accountName: "Ava Futures Process",
    broker: "Interactive Brokers",
    startingBalance: 50000,
    startDate: "2026-04-06",
    dailyPnl: [
      420, 680, -320, 510, 180, 760, -460, 330, 590, -240,
      410, 220, 820, -180, 310, 960, 280, -390, 160, 540,
      -720, -1040, -520, -360, 210, -430, 300, 190, 640, 420,
      -280, 780, 2240, 520, -310, 740, 360, 220, 610, 480,
    ],
    symbols: ["ES", "NQ", "SPX"],
    proofLevel: 4,
    updateReliability: 92,
    reportPeriod: "2026-05",
    report: {
      executive_summary:
        "Ava's seeded profile finished the period positive with a recovered mid-window drawdown and a clear evidence trail from broker-reported data plus private tax-record verification.",
      performance_summary:
        "The account produced steady gains across an active futures sample, with a few outsized sessions contributing meaningfully to total return.",
      risk_summary:
        "Risk remained elevated during the mid-period loss cluster, but the profile recovered and closed near a fresh equity high.",
      discipline_review:
        "Daily participation was consistent and loss clusters stayed contained relative to starting capital, though outlier-day dependency should be monitored.",
      notable_days: [
        "A single volatility-expansion session drove the strongest gain of the period.",
        "The weakest stretch was a four-session drawdown that later recovered.",
      ],
      warnings: [
        "A meaningful share of total profit came from one standout day.",
        "The strategy should keep publishing freshness updates because market-structure regimes change quickly.",
      ],
      client_disclaimer: DISCLAIMER,
    },
    evidence: [
      {
        kind: "TAX_RETURN",
        label: "Private tax-record verification",
        originalName: "ava-rao-redacted-tax-record.txt",
        isPublic: false,
        accountScoped: false,
      },
      {
        kind: "STATEMENT",
        label: "Redacted futures statement",
        originalName: "ava-rao-redacted-broker-statement.txt",
        isPublic: true,
        accountScoped: true,
      },
    ],
    riskEvents: [
      {
        type: "BIG_WIN_DEPENDENCY",
        severity: "WARNING",
        title: "Outlier session contributed heavily",
        description:
          "The best session was material to total profit, so reviewers should compare the process with and without that day.",
      },
      {
        type: "RECOVERY",
        severity: "INFO",
        title: "Mid-period drawdown recovered",
        description: "The account reclaimed the prior equity high before the profile was published.",
      },
    ],
  },
  {
    email: "marcus.chen@quantidive.local",
    name: "Marcus Chen",
    slug: "marcus-chen",
    headline: "Systematic stat-arb researcher - equities and ETFs",
    strategy: "Pairs, ETF baskets, and mean-reversion research",
    instruments: "US equities, sector ETFs",
    bio: "Marcus publishes reproducible stat-arb notes with cost assumptions, regime filters, and post-trade drift checks. His seeded profile is designed for clients who want process clarity before discussing collaboration.",
    services: "Research reviews, scanner design, execution-cost analysis, and systematic process documentation.",
    contactUrl: "https://cal.com/quantidive/marcus-chen-demo",
    openToWork: true,
    updateCadence: "MONTHLY",
    accountName: "Equity Stat-Arb Sleeve",
    broker: "TradeStation",
    startingBalance: 80000,
    startDate: "2026-03-30",
    dailyPnl: [
      260, 190, -140, 310, 220, -180, 280, 340, -210, 150,
      410, -160, 230, 360, 180, -240, 290, 250, -130, 320,
      210, -360, -290, 160, 240, 370, -190, 430, 260, -220,
      310, 520, -180, 270, 190, 330, -150, 280, 240, 390,
    ],
    symbols: ["XLK", "XLF", "IWM", "AAPL"],
    proofLevel: 3,
    updateReliability: 76,
    reportPeriod: "2026-05",
    report: {
      executive_summary:
        "Marcus shows a steadier, lower-volatility seeded profile built around many smaller wins rather than one large event.",
      performance_summary:
        "The account ended positive with a balanced mix of winning and losing days across equity and ETF pairs.",
      risk_summary:
        "Drawdown remained controlled, though the profile should keep monitoring borrow, slippage, and crowded-factor exposure.",
      discipline_review:
        "The return path is consistent with a research-led stat-arb process where position sizing is incremental and repeatable.",
      notable_days: [
        "The strongest day came during a sector-reversion session.",
        "Losses clustered briefly when factor momentum overpowered mean-reversion assumptions.",
      ],
      warnings: [
        "Costs and short availability can materially change live performance.",
        "Backtest assumptions should be reviewed alongside every published note.",
      ],
      client_disclaimer: DISCLAIMER,
    },
    evidence: [
      {
        kind: "STATEMENT",
        label: "Redacted broker statement",
        originalName: "marcus-chen-redacted-statement.txt",
        isPublic: true,
        accountScoped: true,
      },
    ],
    riskEvents: [
      {
        type: "SCORE_CHANGE",
        severity: "INFO",
        title: "Score supported by consistency",
        description: "Transparency score is driven more by risk control and repeatability than raw profit.",
      },
    ],
  },
  {
    email: "priya.nair@quantidive.local",
    name: "Priya Nair",
    slug: "priya-nair",
    headline: "Options flow and GEX analyst - index volatility",
    strategy: "Dealer gamma, 0DTE flow, and volatility regime mapping",
    instruments: "SPX, SPY, QQQ options",
    bio: "Priya focuses on market-structure research: gamma walls, skew shifts, expiration concentration, and intraday invalidation levels. Her seeded profile demonstrates how discussion rooms can stay evidence-led.",
    services: "GEX briefings, market-structure dashboards, options-flow education, and risk review.",
    contactUrl: "https://cal.com/quantidive/priya-nair-demo",
    openToWork: true,
    updateCadence: "WEEKLY",
    accountName: "Index Volatility Research",
    broker: "Tastytrade",
    startingBalance: 60000,
    startDate: "2026-04-01",
    dailyPnl: [
      520, -480, 760, 340, -260, 910, -620, 450, 380, -310,
      640, 290, -540, 1180, 420, -360, 580, -740, 310, 690,
      -420, 520, 870, -390, 460, 330, -280, 760, 390, -510,
      620, 280, 1040, -450, 520, 360, -300, 710, -260, 480,
    ],
    symbols: ["SPX", "SPY", "QQQ"],
    proofLevel: 4,
    updateReliability: 88,
    reportPeriod: "2026-05",
    report: {
      executive_summary:
        "Priya's seeded volatility profile is profitable but more event-sensitive, matching the nature of index-options research.",
      performance_summary:
        "The account generated positive returns with several strong volatility sessions offsetting recurring smaller losses.",
      risk_summary:
        "The drawdown profile is elevated because options-flow work can move quickly when dealer positioning changes.",
      discipline_review:
        "The profile is strongest when each thesis includes invalidation levels and post-session review notes.",
      notable_days: [
        "A high-volume expiration session produced the largest positive day.",
        "The largest losing day followed a rapid volatility crush after the open.",
      ],
      warnings: [
        "Options strategies can change risk shape quickly around expiration.",
        "GEX discussion should remain research, not trade instruction.",
      ],
      client_disclaimer: DISCLAIMER,
    },
    evidence: [
      {
        kind: "TAX_RETURN",
        label: "Private tax-record verification",
        originalName: "priya-nair-redacted-tax-record.txt",
        isPublic: false,
        accountScoped: false,
      },
    ],
    riskEvents: [
      {
        type: "DRAWDOWN",
        severity: "WARNING",
        title: "Volatility regime drawdown",
        description: "The largest drawdown occurred during a fast volatility-regime reversal.",
      },
    ],
  },
  {
    email: "elena.brooks@quantidive.local",
    name: "Elena Brooks",
    slug: "elena-brooks",
    headline: "Portfolio-construction operator - factor and drawdown control",
    strategy: "Multi-strategy allocation, factor overlap, and risk contribution",
    instruments: "ETFs, futures, liquid alternatives",
    bio: "Elena evaluates portfolios like an operating review: factor overlap, correlation, drawdown contribution, and rebalancing discipline. This profile rounds out the diligence side of the Quantidive network.",
    services: "Portfolio diagnostics, factor exposure review, and model governance documentation.",
    contactUrl: "https://cal.com/quantidive/elena-brooks-demo",
    openToWork: false,
    updateCadence: "MONTHLY",
    accountName: "Portfolio Overlay Sleeve",
    broker: "Schwab",
    startingBalance: 120000,
    startDate: "2026-04-13",
    dailyPnl: [
      310, 260, 180, -220, 340, 290, -180, 230, 410, 260,
      -240, 350, 220, 300, -210, 280, 330, 190, -260, 360,
      270, 310, -190, 420, 250, -230, 300, 340, 210, 390,
      -280, 320, 260, 410, -210, 370, 240, 290,
    ],
    symbols: ["SPY", "TLT", "GLD", "VX"],
    proofLevel: 3,
    updateReliability: 72,
    reportPeriod: "2026-05",
    report: {
      executive_summary:
        "Elena's seeded profile emphasizes controlled portfolio behavior and repeatable monitoring over aggressive return seeking.",
      performance_summary:
        "The account finished positive with relatively smooth gains across a diversified overlay sleeve.",
      risk_summary:
        "Drawdown remained controlled and losses were dispersed rather than concentrated in one event.",
      discipline_review:
        "The process is framed around exposure review, rebalancing notes, and risk contribution rather than single-name calls.",
      notable_days: [
        "The best day came from a diversified rally across risk and hedge exposures.",
        "Losses stayed contained during the weakest days.",
      ],
      warnings: [
        "Portfolio overlays require ongoing correlation monitoring.",
        "Allocation discussion must remain educational and non-personalized.",
      ],
      client_disclaimer: DISCLAIMER,
    },
    evidence: [
      {
        kind: "STATEMENT",
        label: "Redacted portfolio statement",
        originalName: "elena-brooks-redacted-statement.txt",
        isPublic: true,
        accountScoped: true,
      },
    ],
    riskEvents: [
      {
        type: "RECOVERY",
        severity: "INFO",
        title: "Controlled drawdown profile",
        description: "The account stayed within a controlled drawdown band during the published window.",
      },
    ],
  },
  {
    email: "noah.okafor@quantidive.local",
    name: "Noah Okafor",
    slug: "noah-okafor",
    headline: "Macro futures researcher - rates, FX, and private-market context",
    strategy: "Macro futures with PE-style risk memos and scenario monitoring",
    instruments: "Treasury futures, FX futures, equity index hedges",
    bio: "Noah writes macro strategy reviews in a diligence format: thesis, scenario map, source data, and what would invalidate the position. His seeded profile bridges trader verification with private-market operating discipline.",
    services: "Macro risk memos, scenario monitoring, and portfolio hedge process reviews.",
    contactUrl: "https://cal.com/quantidive/noah-okafor-demo",
    openToWork: true,
    updateCadence: "WEEKLY",
    accountName: "Macro Scenario Sleeve",
    broker: "Tradovate",
    startingBalance: 70000,
    startDate: "2026-04-20",
    dailyPnl: [
      -260, 430, 520, -310, 610, 280, -420, 740, 360, -280,
      510, 690, -360, 420, -510, 830, 310, 540, -290, 470,
      380, -620, -410, 260, 590, 720, -340, 480, 300, -270,
      650, 390, -330, 560, 420, 710,
    ],
    symbols: ["ZN", "ZB", "6E", "ES"],
    proofLevel: 3,
    updateReliability: 82,
    reportPeriod: "2026-05",
    report: {
      executive_summary:
        "Noah's seeded macro profile is profitable with a clear scenario-review style suited to diligence conversations.",
      performance_summary:
        "The account generated positive returns across rates, FX, and index-hedge sessions with moderate volatility.",
      risk_summary:
        "The largest loss cluster followed a rates reversal, making scenario monitoring central to the profile.",
      discipline_review:
        "The strongest process signal is the use of predefined scenario maps and after-action notes.",
      notable_days: [
        "The strongest day followed a rates breakout with aligned FX confirmation.",
        "The weakest cluster occurred when rates retraced through the prior scenario boundary.",
      ],
      warnings: [
        "Macro futures can gap around central-bank and inflation releases.",
        "Scenario memos should separate observation from trade recommendation.",
      ],
      client_disclaimer: DISCLAIMER,
    },
    evidence: [
      {
        kind: "STATEMENT",
        label: "Redacted futures statement",
        originalName: "noah-okafor-redacted-statement.txt",
        isPublic: true,
        accountScoped: true,
      },
    ],
    riskEvents: [
      {
        type: "LOSS_VS_WIN",
        severity: "INFO",
        title: "Loss cluster reviewed",
        description: "A macro reversal produced a short loss cluster that was documented in the scenario notes.",
      },
    ],
  },
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

function sourceMetrics(trust: ReturnType<typeof computeTrustMetrics>) {
  return JSON.parse(
    JSON.stringify({
      ...trust.metrics,
      bestDayShare: trust.bestDayShare,
      top3Share: trust.top3Share,
      profitWithoutBestDay: trust.profitWithoutBestDay,
      badToGoodRatio: trust.badToGoodRatio,
      drawdownSeverity: trust.drawdownSeverity,
      bounceBackDays: trust.bounceBackDays,
      daysUnderwater: trust.daysUnderwater,
      proofLevel: trust.proofLevel,
      scores: trust.scores,
      verdict: trust.verdict,
    }),
  );
}

async function seedEvidence(trader: SeedTrader, userId: string, accountId: string) {
  for (const item of trader.evidence) {
    const evidence = await prisma.evidence.create({
      data: {
        userId,
        accountId: item.accountScoped ? accountId : null,
        kind: item.kind,
        label: item.label,
        originalName: item.originalName,
        mime: "text/plain",
        size: 0,
        isPublic: item.isPublic,
      },
      select: { id: true },
    });

    const body = [
      `${trader.name} - ${item.label}`,
      "Sanitized demo evidence generated by Quantidive seed data.",
      "This file exists only to make the demo profile links behave like real evidence links.",
    ].join("\n");
    await saveEvidenceFile(evidence.id, Buffer.from(body, "utf8"));
    await prisma.evidence.update({
      where: { id: evidence.id },
      data: { size: Buffer.byteLength(body) },
    });
  }
}

async function seedTrader(trader: SeedTrader, passwordHash: string) {
  const user = await prisma.user.create({
    data: {
      email: trader.email,
      name: trader.name,
      passwordHash,
      profile: {
        create: {
          displayName: trader.name,
          slug: trader.slug,
          isPublic: true,
          updateCadence: trader.updateCadence,
          strategy: trader.strategy,
          instruments: trader.instruments,
          bio: trader.bio,
          openToWork: trader.openToWork,
          headline: trader.headline,
          services: trader.services,
          contactUrl: trader.contactUrl,
        },
      },
    },
  });

  const account = await prisma.tradingAccount.create({
    data: {
      userId: user.id,
      accountName: trader.accountName,
      broker: trader.broker,
      startingBalance: trader.startingBalance,
    },
  });

  await seedEvidence(trader, user.id, account.id);

  const dates = tradingDates(trader.startDate, trader.dailyPnl.length);
  const trades = dates.map((date, i) => ({
    accountId: account.id,
    tradeDate: new Date(date),
    symbol: trader.symbols[i % trader.symbols.length],
    assetType: trader.symbols[i % trader.symbols.length].length <= 3 ? "future" : "stock",
    side: trader.dailyPnl[i] >= 0 ? "LONG" : "SHORT",
    realizedPnl: trader.dailyPnl[i],
    fees: 0,
  }));
  await prisma.trade.createMany({ data: trades });

  const daily = aggregateDaily(
    dates.map((date, i) => ({ tradeDate: date, realizedPnl: trader.dailyPnl[i], fees: 0 })),
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
    trader.startingBalance,
    trader.proofLevel,
    trader.updateReliability,
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

  const version = await prisma.profileVersion.create({
    data: {
      profileId: profile.id,
      versionNumber: 1,
      periodStart: new Date(daily[0].date),
      periodEnd: new Date(daily[daily.length - 1].date),
      metrics: sourceMetrics(trust),
      netPnl: trust.metrics.netPnl,
      returnPct: trust.metrics.returnPct,
      transparencyScore: trust.scores.transparency,
      proofLevel: trader.proofLevel,
      freshnessStatus: "fresh",
      changeSummary: `First published update: ${trust.metrics.tradingDays} trading days, net $${trust.metrics.netPnl.toFixed(0)}, Quantidive Score ${trust.scores.transparency}.`,
      publishedAt,
    },
    select: { id: true },
  });

  if (trader.riskEvents.length > 0) {
    await prisma.riskEvent.createMany({
      data: trader.riskEvents.map((event) => ({
        profileId: profile.id,
        versionId: version.id,
        type: event.type,
        severity: event.severity,
        title: event.title,
        description: event.description,
        metricAfter: event.metricAfter,
        isClientVisible: true,
      })),
    });
  }

  await prisma.report.create({
    data: {
      userId: user.id,
      accountId: account.id,
      period: trader.reportPeriod,
      metrics: {
        netPnl: trust.metrics.netPnl,
        startingBalance: trader.startingBalance,
        returnPct: trust.metrics.returnPct,
        transparencyScore: trust.scores.transparency,
      },
      aiReport: trader.report,
      status: "PUBLISHED",
    },
  });
}

async function main() {
  const emails = SEED_TRADERS.map((trader) => trader.email);
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const existingUserIds = existingUsers.map((user) => user.id);
  if (existingUserIds.length > 0) {
    const oldEvidence = await prisma.evidence.findMany({
      where: { userId: { in: existingUserIds } },
      select: { id: true },
    });
    await Promise.all(oldEvidence.map((evidence) => deleteEvidenceFile(evidence.id)));
  }
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const sharedHash = await bcrypt.hash("demo1234", 10);
  for (const trader of SEED_TRADERS) {
    const passwordHash =
      trader.password && trader.password !== "demo1234"
        ? await bcrypt.hash(trader.password, 10)
        : sharedHash;
    await seedTrader(trader, passwordHash);
  }

  console.log(
    `Seeded ${SEED_TRADERS.length} demo traders -> /explore and /p/demo (login: demo@quantidive.local / demo1234)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
