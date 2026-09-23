import Link from "next/link";
import { redirect } from "next/navigation";
import { subDays, format } from "date-fns";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { computeTrustMetrics } from "@/lib/trust";
import { breakdownByBrokerAndAccount } from "@/lib/metrics";
import { accountProofLevel } from "@/lib/proof";
import { getFreshnessStatus, toCadence, reliabilityFromFreshness } from "@/lib/freshness";
import { toCurrency, toISODate } from "@/lib/format";
import { BrokerageBreakdown } from "@/components/dashboard/brokerage-breakdown";
import { DashboardControls } from "@/components/dashboard/controls";
import { ViewToggle } from "@/components/dashboard/view-toggle";
import { BalanceEditor } from "@/components/dashboard/balance-editor";
import { PortalShare } from "@/components/dashboard/portal-share";
import { ClientView } from "@/components/dashboard/client-view";
import { TraderView } from "@/components/dashboard/trader-view";
import { CalendarHeatmap } from "@/components/dashboard/calendar-heatmap";
import { ProfileStatusCard } from "@/components/dashboard/profile-status";
import { PublishUpdate } from "@/components/dashboard/publish-update";
import { ClientHome } from "@/components/dashboard/client-home";
import { RecordChecklist } from "@/components/dashboard/record-checklist";
import { AnalyticsSummary } from "@/components/dashboard/analytics-summary";
import { InquiriesCard } from "@/components/inquiries/inquiries-card";
import { loadProfileAnalytics } from "../analytics/load";

function rangeStartDate(range: string): Date | null {
  const now = new Date();
  if (range === "30d") return subDays(now, 30);
  if (range === "90d") return subDays(now, 90);
  if (range === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return null; // "all"
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; account?: string; range?: string; view?: string }>;
}) {
  // Onboarded users only; a client never needs a trader profile here.
  const user = await requireOnboardedUser();
  if (user.role === "CLIENT") return <ClientHome userId={user.id} name={user.name} />;
  if (!user.profile) redirect("/onboarding");
  const profile = user.profile;

  const { imported, account: accountParam, range: rangeParam, view: viewParam } = await searchParams;
  const range = rangeParam ?? "all";
  const view = viewParam === "trader" ? "trader" : "client";

  const accounts = await prisma.tradingAccount.findMany({
    where: { userId: user.id },
    select: { id: true, accountName: true, startingBalance: true, broker: true, currency: true },
    orderBy: { createdAt: "asc" },
  });
  const account = accounts.find((a) => a.id === accountParam) ?? accounts[0];
  const currency = toCurrency(account?.currency);

  const start = rangeStartDate(range);

  // Brokerage-wise breakdown — net P&L by broker → account for the same date
  // range. Amounts in different currencies can't be summed, so it only covers
  // accounts in the selected account's currency (and needs 2+ of them).
  const sameCurrency = accounts.filter((a) => toCurrency(a.currency) === currency);
  const mixedCurrencies = sameCurrency.length < accounts.length;
  let breakdown: ReturnType<typeof breakdownByBrokerAndAccount> | null = null;
  if (sameCurrency.length > 1) {
    const accountById = new Map(sameCurrency.map((a) => [a.id, a]));
    const allDays = await prisma.dailyPnl.findMany({
      where: {
        accountId: { in: sameCurrency.map((a) => a.id) },
        account: { userId: user.id },
        ...(start ? { tradeDate: { gte: start } } : {}),
      },
      select: { accountId: true, tradeDate: true, netPnl: true, grossPnl: true, fees: true, tradeCount: true },
    });
    breakdown = breakdownByBrokerAndAccount(
      allDays.map((d) => {
        const acct = accountById.get(d.accountId);
        return {
          broker: acct?.broker?.trim() || acct?.accountName || "Unknown",
          accountId: d.accountId,
          accountName: acct?.accountName ?? "Unknown",
          date: toISODate(d.tradeDate),
          netPnl: Number(d.netPnl),
          grossPnl: Number(d.grossPnl),
          fees: Number(d.fees),
          tradeCount: d.tradeCount,
        };
      }),
    );
  }
  const days = account
    ? await prisma.dailyPnl.findMany({
        where: { accountId: account.id, ...(start ? { tradeDate: { gte: start } } : {}) },
        select: { tradeDate: true, netPnl: true },
        orderBy: { tradeDate: "asc" },
      })
    : [];

  const dailySeries = days.map((d) => ({ date: toISODate(d.tradeDate), netPnl: Number(d.netPnl) }));
  const proofLevel = account ? await accountProofLevel(account.id, dailySeries.length > 0) : 1;
  const reliability = reliabilityFromFreshness(
    getFreshnessStatus(toCadence(profile.updateCadence), profile.lastPublishedAt),
  );
  const trust =
    account && dailySeries.length > 0
      ? computeTrustMetrics(dailySeries, Number(account.startingBalance), proofLevel, reliability)
      : null;
  const equitySeries =
    trust?.metrics.equityCurve.map((p) => ({ date: p.date, equity: p.equity })) ?? [];

  const [coverage, lastVersion, details, analytics] = await Promise.all([
    // Profile-wide data coverage (all accounts, ignoring the range filter) for the status card.
    prisma.dailyPnl.aggregate({
      where: { account: { userId: user.id } },
      _min: { tradeDate: true },
      _max: { tradeDate: true },
    }),
    // Latest published profile version (for the Publish card).
    prisma.profileVersion.findFirst({
      where: { profileId: profile.id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true, publishedAt: true, changeSummary: true },
    }),
    // Structured identity for the "Complete your record" checklist.
    prisma.traderProfile.findUnique({
      where: { id: profile.id },
      select: {
        markets: true,
        strategyTags: true,
        region: true,
        experienceYears: true,
        acceptInquiries: true,
      },
    }),
    loadProfileAnalytics(profile.id, 30),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="terminal-label">Operator record / live workspace</p>
          <h1 className="mt-2 break-words text-3xl font-medium tracking-[-0.04em] text-zinc-900">
            {profile.displayName}
          </h1>
          <PortalShare slug={profile.slug} isPublic={profile.isPublic} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle view={view} />
          {account && <DashboardControls accounts={accounts.map((a) => ({ id: a.id, accountName: a.accountName }))} accountId={account.id} range={range} />}
          <Link
            href="/upload"
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm hover:bg-white"
          >
            Import history
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsSummary analytics={analytics} />
        <RecordChecklist
          items={[
            { key: "public", label: "Profile is public", done: profile.isPublic, href: "/settings#privacy" },
            { key: "markets", label: "Markets traded set", done: (details?.markets.length ?? 0) > 0, href: "/settings#trader-profile" },
            { key: "strategy", label: "Strategy style set", done: (details?.strategyTags.length ?? 0) > 0, href: "/settings#trader-profile" },
            { key: "region", label: "Region set", done: !!details?.region, href: "/settings#trader-profile" },
            { key: "experience", label: "Years of experience set", done: details?.experienceYears != null, href: "/settings#trader-profile" },
            { key: "import", label: "Trading history imported", done: !!coverage._max.tradeDate, href: "/upload" },
            { key: "publish", label: "Record published", done: !!lastVersion, href: "#publish" },
            { key: "inquiries", label: "Accepting conversation requests", done: !!details?.acceptInquiries, href: "/settings#availability" },
          ]}
        />
      </div>

      <InquiriesCard userId={user.id} />

      <ProfileStatusCard
        isPublic={profile.isPublic}
        proofLevel={proofLevel}
        cadence={profile.updateCadence}
        lastPublishedAt={profile.lastPublishedAt}
        coverageStart={coverage._min.tradeDate ? toISODate(coverage._min.tradeDate) : null}
        coverageEnd={coverage._max.tradeDate ? toISODate(coverage._max.tradeDate) : null}
      />

      <div id="publish" className="scroll-mt-28">
        <PublishUpdate
          accountId={account?.id ?? ""}
          lastVersionNumber={lastVersion?.versionNumber ?? null}
          lastPublishedLabel={lastVersion ? format(lastVersion.publishedAt, "MMM d, yyyy") : null}
          lastChangeSummary={lastVersion?.changeSummary ?? null}
        />
      </div>

      {account && (
        <BalanceEditor
          accountId={account.id}
          startingBalance={Number(account.startingBalance)}
          currency={currency}
        />
      )}

      {imported && (
        <div className="rounded-lg bg-zinc-900/70 px-4 py-2 text-sm text-zinc-100">
          Loaded {imported} trades. Your metrics are updated below.
        </div>
      )}

      {breakdown && (
        <BrokerageBreakdown
          brokers={breakdown.brokers}
          totalNet={breakdown.totalNet}
          currency={currency}
          title={mixedCurrencies ? `By brokerage (${currency} accounts)` : undefined}
        />
      )}

      {trust ? (
        view === "trader" ? (
          <TraderView
            metrics={trust.metrics}
            equitySeries={equitySeries}
            dailySeries={dailySeries}
            currency={currency}
          />
        ) : (
          <ClientView trust={trust} equitySeries={equitySeries} dailySeries={dailySeries} currency={currency} />
        )
      ) : (
        <div className="terminal-card border-dashed p-10 text-center">
          <h2 className="text-base font-medium text-zinc-800">
            {account ? "No trades in this range" : "No trading data yet"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            {account
              ? "Try a wider date range, or import more trading history."
              : "Import broker or prop-firm history to build your TrustSVAN performance record."}
          </p>
          <Link
            href="/upload"
            className="mt-4 inline-flex rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm hover:bg-white"
          >
            {account ? "Import more history" : "Import history"}
          </Link>
        </div>
      )}

      {trust && <CalendarHeatmap data={dailySeries} currency={currency} />}
    </div>
  );
}
