import type { Metadata } from "next";
import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatPercent, toISODate } from "@/lib/format";
import { aiReportSchema } from "@/lib/ai/schema";
import { publishedTrustFromMetrics } from "@/lib/published-profile";
import {
  describeFreshness,
  toCadence,
  cadenceLabel,
} from "@/lib/freshness";
import { ClientView } from "@/components/dashboard/client-view";
import { CalendarHeatmap } from "@/components/dashboard/calendar-heatmap";
import { ReportSections } from "@/components/report-sections";
import { ProfileTrust } from "@/components/portal/profile-trust";
import { SiteFooter } from "@/components/site-footer";
import { PrintButton } from "./print-button";
import { FollowForm } from "./follow-form";

const DEFAULT_DISCLAIMER =
  "TrustSVAN is research, analytics, and professional networking software. It does not manage money, execute trades, or provide investment advice. Past performance does not guarantee future results.";

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
    title: profile?.isPublic ? `${profile.displayName} - TrustSVAN` : "TrustSVAN",
    robots: { index: profile?.isPublic === true, follow: profile?.isPublic === true },
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
      id: true,
      userId: true,
      displayName: true,
      bio: true,
      strategy: true,
      instruments: true,
      disclaimer: true,
      isPublic: true,
      hideAmounts: true,
      hideBrokers: true,
      updateCadence: true,
      lastPublishedAt: true,
      openToWork: true,
      headline: true,
      services: true,
      contactUrl: true,
    },
  });

  if (!profile || !profile.isPublic) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 px-4 py-16 text-center">
        <div>
          <p className="text-lg font-semibold text-white">This research profile isn&apos;t available</p>
          <p className="mt-1 text-sm text-zinc-400">
            The link may be wrong, or the trader has set their profile to private.
          </p>
        </div>
      </div>
    );
  }

  const latestVersion = await prisma.profileVersion.findFirst({
    where: { profileId: profile.id },
    orderBy: { versionNumber: "desc" },
    select: { id: true, changeSummary: true, publishedAt: true, metrics: true },
  });
  const versionRows = await prisma.profileVersion.findMany({
    where: { profileId: profile.id },
    orderBy: { versionNumber: "desc" },
    take: 24,
    select: {
      id: true,
      versionNumber: true,
      periodStart: true,
      periodEnd: true,
      publishedAt: true,
      netPnl: true,
      returnPct: true,
      metrics: true,
      sourceBatch: { select: { source: true } },
    },
  });
  const versionHistory = versionRows.map((version) => ({
    ...version,
    maxDrawdownPct:
      (version.metrics as { maxDrawdownPct?: number } | null)?.maxDrawdownPct ?? null,
  }));
  const snapshot = latestVersion ? publishedTrustFromMetrics(latestVersion.metrics) : null;
  const trust = snapshot?.trust ?? null;
  const dailySeries = snapshot?.dailySeries ?? [];
  const equitySeries = snapshot?.equitySeries ?? [];
  const period =
    dailySeries.length > 0
      ? `${dateLabel(dailySeries[0].date)} - ${dateLabel(dailySeries[dailySeries.length - 1].date)}`
      : null;

  // Account/broker labels are used only to redact brief prose when privacy is on.
  const privateAccounts = await prisma.tradingAccount.findMany({
    where: { userId: profile.userId },
    select: { id: true, accountName: true, broker: true },
    orderBy: { createdAt: "asc" },
  });
  const privateReportTerms = privateAccounts.flatMap((a) => [a.accountName, a.broker ?? ""]);

  // Living-profile header (MVP2): freshness + latest version's change summary + risk events.
  const coverageEndForFreshness = dailySeries.at(-1)?.date
    ? new Date(`${dailySeries.at(-1)!.date}T00:00:00Z`)
    : null;
  const fresh = describeFreshness(toCadence(profile.updateCadence), coverageEndForFreshness);
  const riskEvents = latestVersion
    ? await prisma.riskEvent.findMany({
        where: { versionId: latestVersion.id, isClientVisible: true },
        select: { id: true, type: true, severity: true, title: true, description: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const lastUpdatedLabel = latestVersion ? dateLabel(toISODate(latestVersion.publishedAt)) : null;

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
    TAX_RETURN: "Tax return",
    PAYOUT: "Payout",
    EXPORT: "Export",
    OTHER: "Other",
  };

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#8f9d8e] print:hidden">
        <div className="mx-auto flex h-8 max-w-4xl items-center justify-between px-4">
          <span className="flex items-center gap-2"><i className="terminal-dot" /> Published record</span>
          <span>Immutable snapshot / operator controlled</span>
        </div>
      </div>
      {/* Slim nav hidden when printing / saving the report as PDF. */}
      <nav className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <Link
            href={loggedIn ? "/dashboard" : "/"}
            className="text-xl font-semibold text-zinc-100"
          >
            <SvanLogo />
          </Link>
          <Link
            href={loggedIn ? "/network" : "/explore"}
            className="text-sm font-medium text-zinc-200 hover:text-zinc-100"
          >
            Published traders
          </Link>
        </div>
      </nav>

      <header className="terminal-grid border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-5 px-4 py-10">
          <div>
            <p className="terminal-label">
              <Link
                href={loggedIn ? "/dashboard" : "/"}
                className="transition hover:text-zinc-200"
              >
                <SvanLogo />
              </Link>{" "}
              / research profile
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-4xl font-medium tracking-[-0.045em] text-white">
                {profile.displayName}
              </h1>
              {profile.openToWork && (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300/40 bg-zinc-300/10 px-2 py-0.5 text-xs font-medium text-zinc-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-200" aria-hidden="true" />
                  Open to work
                </span>
              )}
            </div>
            {profile.headline && (
              <p className="mt-1 text-sm font-medium text-zinc-300">{profile.headline}</p>
            )}
            <p className="mt-0.5 text-sm text-zinc-400">
              {[profile.strategy, profile.instruments].filter(Boolean).join(" / ")}
              {period && <span className="text-zinc-400"> / {period}</span>}
            </p>
          </div>
          <PrintButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        {profile.bio && <p className="text-sm leading-relaxed text-zinc-300">{profile.bio}</p>}

        {(profile.openToWork || profile.contactUrl) && (
          <section className="terminal-card p-5 print:hidden">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">Work with {profile.displayName}</h2>
                {profile.services ? (
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{profile.services}</p>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    Open to client work and collaboration. Reach out to start a conversation.
                  </p>
                )}
              </div>
              {profile.contactUrl && (
                <a
                  href={profile.contactUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="shrink-0 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
                >
                  Get in touch
                </a>
              )}
            </div>
          </section>
        )}

        <ProfileTrust
          freshness={{ label: fresh.label, blurb: fresh.blurb, tone: fresh.tone }}
          lastUpdatedLabel={lastUpdatedLabel}
          cadenceLabel={cadenceLabel(toCadence(profile.updateCadence))}
          changeSummary={latestVersion?.changeSummary ?? null}
          riskEvents={riskEvents}
          proofLevel={trust?.proofLevel ?? null}
        />

        {versionHistory.length > 0 && (
          <section className="terminal-card overflow-hidden">
            <div className="border-b border-zinc-800 px-5 py-4">
              <h2 className="text-base font-medium text-white">Published record history</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Immutable snapshots show how coverage changed over time. Publication time and data
                coverage are shown separately.
              </p>
            </div>
            <ul className="divide-y divide-zinc-800">
              {versionHistory.map((version) => (
                <li key={version.id} className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[1.2fr_.8fr_.8fr] sm:items-center">
                  <div>
                    <p className="font-medium text-zinc-200">
                      Version {version.versionNumber}
                      <span className="ml-2 font-normal text-zinc-400">
                        {version.periodStart && version.periodEnd
                          ? `${dateLabel(toISODate(version.periodStart))} – ${dateLabel(toISODate(version.periodEnd))}`
                          : "Coverage unavailable"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {version.sourceBatch?.source === "BROKER_API"
                        ? "Direct broker source"
                        : version.sourceBatch
                          ? "Trader-uploaded export"
                          : "Source not recorded"}
                      {` · Published ${dateLabel(toISODate(version.publishedAt))}`}
                    </p>
                  </div>
                  <div>
                    <span className="terminal-label">Period result</span>
                    <p className="mt-1 font-mono text-zinc-200">
                      {version.returnPct != null ? formatPercent(version.returnPct, 1) : "Not available"}
                      {!profile.hideAmounts && ` · ${formatMoney(Number(version.netPnl))}`}
                    </p>
                  </div>
                  <div>
                    <span className="terminal-label">Max drawdown</span>
                    <p className="mt-1 font-mono text-zinc-200">
                      {version.maxDrawdownPct != null ? `${version.maxDrawdownPct.toFixed(1)}%` : "Not available"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {trust ? (
          <ClientView
            trust={trust}
            equitySeries={equitySeries}
            dailySeries={dailySeries}
            hideAmounts={profile.hideAmounts}
          />
        ) : (
          <div className="terminal-card border-dashed p-10 text-center text-sm text-zinc-400">
            No published record yet.
          </div>
        )}

        {trust && <CalendarHeatmap data={dailySeries} hideAmounts={profile.hideAmounts} />}

        {reports.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Research and performance briefs</h2>
            {reports.map((r) => (
              <ReportSections
                key={r.id}
                period={r.period}
                report={r.report}
                hideAmounts={profile.hideAmounts}
                redactTerms={profile.hideBrokers ? privateReportTerms : []}
              />
            ))}
          </section>
        )}

        {evidence.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Evidence</h2>
            <p className="text-sm text-zinc-400">Supporting documents shared by the researcher.</p>
            <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/70">
              {evidence.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span className="truncate font-medium text-zinc-200">
                    {e.label || e.originalName}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-400">{KIND_LABEL[e.kind]} attached · file private</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3 print:hidden">
          <h2 className="text-lg font-semibold text-white">Follow this researcher</h2>
          <p className="text-sm text-zinc-400">
            Get profile and research updates by email. Not investment advice.
          </p>
          <FollowForm slug={slug} />
        </section>
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950 print:hidden">
        <div className="mx-auto max-w-4xl space-y-2 px-4 py-6 text-xs leading-relaxed text-zinc-400">
          {profile.disclaimer && <p>{profile.disclaimer}</p>}
          <p>{DEFAULT_DISCLAIMER}</p>
        </div>
      </footer>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
