import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { SvanLogo } from "@/components/svan-logo";
import { SiteFooter } from "@/components/site-footer";
import { DirectoryCard } from "@/components/explore/directory-card";
import { ExploreDirectory, type CompareFact, type ExploreEntry } from "@/components/explore/explore-directory";
import { IllustrativeExamples } from "@/components/explore/illustrative-examples";
import { optionalUserId } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { loadDirectory, type DirectoryTrader } from "@/lib/directory";
import {
  formatDrawdown,
  formatMonths,
  formatReturn,
  hasDeclaredRegistration,
  type ClientPreferences,
} from "@/lib/directory-filters";
import { EXAMPLE_OPERATORS } from "@/lib/example-operators";
import { logger } from "@/lib/logger";
import { optionLabel, optionLabels } from "@/lib/profile-options";
import { coverageLabel } from "@/lib/record-context";

const TITLE = "Explore trader records — TrustSVAN";
const DESCRIPTION =
  "Browse public, source-linked trading records by market, strategy, region, capital band, record source, and record length. Sorted by recency — never by return or score.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Rebuild the request query string (the client directory parses and validates it). */
function toQueryString(sp: Awaited<SearchParams>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    for (const v of [value].flat()) if (typeof v === "string") qs.append(key, v);
  }
  return qs.toString();
}

function compareFacts(t: DirectoryTrader): CompareFact[] {
  const registration = t.credentialsHidden
    ? "Not shown by trader"
    : hasDeclaredRegistration(t.registrationType)
      ? `${optionLabel("registrationTypes", t.registrationType)} (self-declared)`
      : "None declared";
  return [
    { label: "Record source", value: t.record?.source ?? "No published record" },
    { label: "Review status", value: t.record?.reviewStatus ?? "—" },
    { label: "Coverage", value: t.record ? coverageLabel(t.record) : "—" },
    { label: "Record length", value: formatMonths(t.record?.months) },
    { label: "Markets", value: optionLabels("markets", t.markets).join(", ") || "Not declared" },
    { label: "Strategy", value: optionLabels("strategyTags", t.strategyTags).join(", ") || t.strategy || "Not declared" },
    { label: "Region", value: optionLabel("regions", t.region) ?? "Not declared" },
    {
      label: "Experience",
      value:
        t.experienceYears == null
          ? "Not declared"
          : `${t.experienceYears} year${t.experienceYears === 1 ? "" : "s"} (self-declared)`,
    },
    { label: "Capital band", value: optionLabel("capitalBands", t.capitalBand) ?? "Not disclosed" },
    { label: "Registration", value: registration },
    { label: "Period return", value: formatReturn(t.returnPct) },
    { label: "Max drawdown", value: formatDrawdown(t.maxDrawdownPct) },
  ];
}

async function viewerContext(viewerId: string | null) {
  if (!viewerId) return { role: null, preferences: null as ClientPreferences | null };
  const user = await prisma.user.findUnique({
    where: { id: viewerId },
    select: {
      role: true,
      clientProfile: { select: { markets: true, regions: true, strategyTags: true } },
    },
  });
  const preferences = user?.role === "CLIENT" && user.clientProfile ? user.clientProfile : null;
  return { role: user?.role ?? null, preferences };
}

export default async function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  const [viewerId, sp] = await Promise.all([optionalUserId(), searchParams]);
  const signedIn = viewerId !== null;

  let traders: DirectoryTrader[] | null = null;
  let viewer: Awaited<ReturnType<typeof viewerContext>> = { role: null, preferences: null };
  try {
    [traders, viewer] = await Promise.all([loadDirectory(viewerId), viewerContext(viewerId)]);
  } catch (error) {
    logger.error("explore.load_failed", { error: error instanceof Error ? error.message : String(error) });
  }

  const now = new Date();
  const entries: ExploreEntry[] = (traders ?? []).map((t) => ({
    profileId: t.profileId,
    slug: t.slug,
    displayName: t.displayName,
    headline: t.headline,
    strategy: t.strategy,
    markets: t.markets,
    strategyTags: t.strategyTags,
    region: t.region,
    capitalBand: t.capitalBand,
    experienceYears: t.experienceYears,
    registrationType: t.registrationType,
    acceptInquiries: t.acceptInquiries,
    lastActive: t.lastActive,
    following: t.following,
    watching: t.watching,
    record: t.record ? { source: t.record.source, months: t.record.months } : null,
    facts: compareFacts(t),
    card: <DirectoryCard trader={t} signedIn={signedIn} now={now} />,
  }));

  // Fictional examples live in their own section; skip any whose slug a real profile now uses.
  const realSlugs = new Set(entries.map((e) => e.slug));
  const examples = EXAMPLE_OPERATORS.filter((example) => !realSlugs.has(example.slug));

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#8f9d8e]">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <span className="flex items-center gap-2">
            <i className="terminal-dot" /> Public records
          </span>
          <span className="hidden sm:block">Published snapshots / trader controlled</span>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-8">
          <Link href={signedIn ? "/dashboard" : "/"} className="shrink-0 text-xl font-semibold text-zinc-100" aria-label="TrustSVAN home">
            <SvanLogo />
          </Link>
          {signedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-zinc-100 px-4 text-xs font-medium text-zinc-950 hover:bg-white"
            >
              Workspace <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <div className="flex items-center gap-3 text-xs sm:gap-4">
              <Link href="/login" className="hidden text-zinc-400 hover:text-zinc-100 sm:inline">
                Sign in
              </Link>
              <Link
                href="/signup?as=client"
                className="hidden min-h-10 items-center rounded-md border border-zinc-700 px-4 text-zinc-200 hover:border-zinc-400 sm:inline-flex"
              >
                Join as a client
              </Link>
              <Link
                href="/signup"
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-zinc-100 px-4 font-medium text-zinc-950 hover:bg-white"
              >
                Build your record <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </header>

      <main>
        <section className="terminal-grid border-b border-zinc-800">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16">
            <p className="terminal-label flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-[#baf277]" aria-hidden="true" /> Discovery, with context
            </p>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.55fr] lg:items-end">
              <h1 className="max-w-4xl text-4xl font-medium leading-[1.05] tracking-[-0.055em] sm:text-6xl">
                Inspect the record.
                <br />
                <span className="text-[#8b998b]">Not the follower count.</span>
              </h1>
              <div className="max-w-lg lg:justify-self-end">
                <p className="text-sm leading-7 text-[#9aa79c]">
                  Filter public records by market, strategy, region, capital band, record source, and record length. Every
                  card shows where the record came from and what window it covers. Sorted by recency — never by return or
                  score.
                </p>
                {!signedIn && (
                  <p className="mt-3 text-xs text-[#8f9c8d] sm:hidden">
                    Reviewing traders?{" "}
                    <Link href="/signup?as=client" className="text-[#baf277] hover:underline">
                      Join as a client
                    </Link>
                    <span className="text-zinc-600"> · </span>
                    <Link href="/login" className="text-[#baf277] hover:underline">
                      Sign in
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
          {traders === null ? (
            <div className="terminal-card px-6 py-14 text-center" role="alert">
              <h2 className="text-base font-medium text-zinc-100">The directory is temporarily unavailable.</h2>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#8d9a8e]">
                We couldn&apos;t load public records just now. Please refresh in a moment.
              </p>
            </div>
          ) : entries.length === 0 ? (
            <div className="terminal-card px-6 py-14 text-center">
              <p className="terminal-label">Public records / 0</p>
              <h2 className="mt-3 text-lg font-medium text-zinc-100">No public records yet.</h2>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#8d9a8e]">
                Records appear here once a trader imports their trading history and publishes a snapshot. The examples below
                are fictional and only show how a record reads.
              </p>
              {viewer.role !== "CLIENT" && (
                <Link
                  href={signedIn ? "/dashboard" : "/signup"}
                  className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md bg-[#baf277] px-4 text-xs font-medium text-[#17200e]"
                >
                  {signedIn ? "Publish your record" : "Build your record"} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          ) : (
            <ExploreDirectory
              entries={entries}
              signedIn={signedIn}
              preferences={viewer.preferences}
              initialQuery={toQueryString(sp)}
            />
          )}

          <IllustrativeExamples examples={examples} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
