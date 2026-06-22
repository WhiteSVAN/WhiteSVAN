import type { Metadata } from "next";
import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { toISODate } from "@/lib/format";
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
  "truSVAN is research, analytics, and professional networking software. It does not manage money, execute trades, or provide investment advice. Past performance does not guarantee future results.";

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
    title: profile?.isPublic ? `${profile.displayName} - truSVAN` : "truSVAN",
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
      <div className="flex min-h-full flex-1 items-center justify-center bg-slate-950 px-4 py-16 text-center">
        <div>
          <p className="text-lg font-semibold text-white">This research profile isn&apos;t available</p>
          <p className="mt-1 text-sm text-slate-400">
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
  const publishedAtForFreshness = profile.lastPublishedAt ?? latestVersion?.publishedAt ?? null;
  const fresh = describeFreshness(toCadence(profile.updateCadence), publishedAtForFreshness);
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
    <div className="min-h-full bg-slate-950 text-slate-100">
      {/* Slim nav hidden when printing / saving the report as PDF. */}
      <nav className="border-b border-slate-800 bg-slate-950/90 print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={loggedIn ? "/dashboard" : "/"}
            className="text-sm font-semibold tracking-[0.14em] text-slate-100"
          >
            <SvanLogo />
          </Link>
          <Link
            href={loggedIn ? "/network" : "/explore"}
            className="text-sm font-medium text-cyan-300 hover:text-cyan-100"
          >
            Verified traders
          </Link>
        </div>
      </nav>

      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              <Link
                href={loggedIn ? "/dashboard" : "/"}
                className="transition hover:text-cyan-300"
              >
                <SvanLogo />
              </Link>{" "}
              / research profile
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {profile.displayName}
              </h1>
              {profile.openToWork && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  Open to work
                </span>
              )}
            </div>
            {profile.headline && (
              <p className="mt-1 text-sm font-medium text-slate-300">{profile.headline}</p>
            )}
            <p className="mt-0.5 text-sm text-slate-400">
              {[profile.strategy, profile.instruments].filter(Boolean).join(" / ")}
              {period && <span className="text-slate-400"> / {period}</span>}
            </p>
          </div>
          <PrintButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        {profile.bio && <p className="text-sm leading-relaxed text-slate-300">{profile.bio}</p>}

        {(profile.openToWork || profile.contactUrl) && (
          <section className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-5 print:hidden">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">Work with {profile.displayName}</h2>
                {profile.services ? (
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{profile.services}</p>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    Open to client work and collaboration. Reach out to start a conversation.
                  </p>
                )}
              </div>
              {profile.contactUrl && (
                <a
                  href={profile.contactUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="shrink-0 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300"
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

        {trust ? (
          <ClientView
            trust={trust}
            equitySeries={equitySeries}
            dailySeries={dailySeries}
            hideAmounts={profile.hideAmounts}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-sm text-slate-400">
            No published record yet.
          </div>
        )}

        {trust && <CalendarHeatmap data={dailySeries} hideAmounts={profile.hideAmounts} />}

        {reports.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-white">Research and performance briefs</h2>
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
            <h2 className="text-lg font-semibold tracking-tight text-white">Evidence</h2>
            <p className="text-sm text-slate-400">Supporting documents shared by the researcher.</p>
            <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/70">
              {evidence.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <a
                    href={`/api/evidence/${e.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-medium text-cyan-300 hover:text-cyan-100"
                  >
                    {e.label || e.originalName}
                  </a>
                  <span className="shrink-0 text-xs text-slate-400">{KIND_LABEL[e.kind]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3 print:hidden">
          <h2 className="text-lg font-semibold tracking-tight text-white">Follow this researcher</h2>
          <p className="text-sm text-slate-400">
            Get profile and research updates by email. Not investment advice.
          </p>
          <FollowForm slug={slug} />
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 print:hidden">
        <div className="mx-auto max-w-4xl space-y-2 px-4 py-6 text-xs leading-relaxed text-slate-400">
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
