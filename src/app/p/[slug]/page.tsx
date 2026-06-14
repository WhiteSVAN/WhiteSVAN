import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { computeTrustMetrics } from "@/lib/trust";
import { breakdownByBrokerAndAccount } from "@/lib/metrics";
import { accountProofLevel } from "@/lib/proof";
import { toISODate } from "@/lib/format";
import { aiReportSchema } from "@/lib/ai/schema";
import { ClientView } from "@/components/dashboard/client-view";
import { BrokerageBreakdown } from "@/components/dashboard/brokerage-breakdown";
import { CalendarHeatmap } from "@/components/dashboard/calendar-heatmap";
import { ReportSections } from "@/components/report-sections";
import { PrintButton } from "./print-button";
import { BackButton } from "./back-button";

const DEFAULT_DISCLAIMER =
  "TrustSVAN is reporting and analytics software. It does not manage money, execute trades, or provide investment advice. Past performance does not guarantee future results.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await prisma.traderProfile.findUnique({
    where: { slug },
    select: { displayName: true, isPublic: true },
  });
  return {
    title: profile?.isPublic ? `${profile.displayName} — TrustSVAN` : "TrustSVAN",
    robots: { index: false }, // private share links shouldn't be indexed
  };
}

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function PortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const loggedIn = !!session?.user;

  const profile = await prisma.traderProfile.findUnique({
    where: { slug },
    select: {
      userId: true,
      displayName: true,
      bio: true,
      strategy: true,
      instruments: true,
      disclaimer: true,
      isPublic: true,
      hideAmounts: true,
    },
  });

  if (!profile || !profile.isPublic) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-4 py-16 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-900">This portal isn&apos;t available</p>
          <p className="mt-1 text-sm text-slate-500">
            The link may be wrong, or the trader has set their portal to private.
          </p>
        </div>
      </div>
    );
  }

  const account = await prisma.tradingAccount.findFirst({
    where: { userId: profile.userId },
    select: { id: true, startingBalance: true },
    orderBy: { createdAt: "asc" },
  });
  const days = account
    ? await prisma.dailyPnl.findMany({
        where: { accountId: account.id },
        select: { tradeDate: true, netPnl: true },
        orderBy: { tradeDate: "asc" },
      })
    : [];

  const dailySeries = days.map((d) => ({ date: toISODate(d.tradeDate), netPnl: Number(d.netPnl) }));
  const proofLevel = account ? await accountProofLevel(account.id, dailySeries.length > 0) : 1;
  const trust =
    account && dailySeries.length > 0
      ? computeTrustMetrics(dailySeries, Number(account.startingBalance), proofLevel)
      : null;
  const equitySeries =
    trust?.metrics.equityCurve.map((p) => ({ date: p.date, equity: p.equity })) ?? [];
  const period =
    dailySeries.length > 0
      ? `${dateLabel(dailySeries[0].date)} – ${dateLabel(dailySeries[dailySeries.length - 1].date)}`
      : null;

  // All-account brokerage → account P&L breakdown (the trust view above is the
  // primary account only). Self-hides under 2 accounts; respects $ redaction.
  const portalAccounts = await prisma.tradingAccount.findMany({
    where: { userId: profile.userId },
    select: { id: true, accountName: true, broker: true },
    orderBy: { createdAt: "asc" },
  });
  let breakdown: ReturnType<typeof breakdownByBrokerAndAccount> | null = null;
  if (portalAccounts.length > 1) {
    const accountById = new Map(portalAccounts.map((a) => [a.id, a]));
    const allDays = await prisma.dailyPnl.findMany({
      where: { account: { userId: profile.userId } },
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

  const reportRows = await prisma.report.findMany({
    where: { userId: profile.userId, status: "PUBLISHED" },
    select: { id: true, period: true, aiReport: true },
    orderBy: { period: "desc" },
  });
  const reports = reportRows.flatMap((r) => {
    const parsed = aiReportSchema.safeParse(r.aiReport);
    return parsed.success ? [{ id: r.id, period: r.period, report: parsed.data }] : [];
  });

  const evidence = await prisma.evidence.findMany({
    where: { userId: profile.userId, isPublic: true },
    select: { id: true, kind: true, label: true, originalName: true },
    orderBy: { createdAt: "desc" },
  });
  const KIND_LABEL: Record<string, string> = {
    STATEMENT: "Statement",
    PAYOUT: "Payout",
    EXPORT: "Export",
    OTHER: "Other",
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* Slim nav — hidden when printing / saving the report as PDF. */}
      <nav className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <BackButton />
          <Link
            href={loggedIn ? "/dashboard" : "/explore"}
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            {loggedIn ? "Dashboard" : "Explore traders"}
          </Link>
        </div>
      </nav>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              <Link
                href={loggedIn ? "/dashboard" : "/"}
                className="transition hover:text-slate-600"
              >
                Trust<span className="text-blue-700">SVAN</span>
              </Link>{" "}
              · verified report
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {profile.displayName}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {[profile.strategy, profile.instruments].filter(Boolean).join(" · ")}
              {period && <span className="text-slate-400"> · {period}</span>}
            </p>
          </div>
          <PrintButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        {profile.bio && <p className="text-sm leading-relaxed text-slate-600">{profile.bio}</p>}

        {trust ? (
          <ClientView
            trust={trust}
            equitySeries={equitySeries}
            dailySeries={dailySeries}
            hideAmounts={profile.hideAmounts}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No published performance yet.
          </div>
        )}

        {trust && <CalendarHeatmap data={dailySeries} hideAmounts={profile.hideAmounts} />}

        {breakdown && (
          <BrokerageBreakdown
            brokers={breakdown.brokers}
            totalNet={breakdown.totalNet}
            hideAmounts={profile.hideAmounts}
          />
        )}

        {reports.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Monthly reports</h2>
            {reports.map((r) => (
              <ReportSections key={r.id} period={r.period} report={r.report} />
            ))}
          </section>
        )}

        {evidence.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Evidence</h2>
            <p className="text-sm text-slate-500">Supporting documents shared by the trader.</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {evidence.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <a
                    href={`/api/evidence/${e.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-medium text-blue-700 hover:text-blue-800"
                  >
                    {e.label || e.originalName}
                  </a>
                  <span className="shrink-0 text-xs text-slate-400">{KIND_LABEL[e.kind]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 text-xs leading-relaxed text-slate-400">
          {profile.disclaimer || DEFAULT_DISCLAIMER}
        </div>
      </footer>
    </div>
  );
}
