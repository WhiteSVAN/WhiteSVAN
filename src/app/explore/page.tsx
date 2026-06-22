import type { Metadata } from "next";
import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PROOF_LEVELS, type DrawdownSeverity } from "@/lib/trust";
import { formatPercent } from "@/lib/format";
import { publishedTrustFromMetrics } from "@/lib/published-profile";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Verified traders - TrustSVAN" };

const SEVERITY: Record<DrawdownSeverity, { label: string; cls: string }> = {
  controlled: { label: "Controlled", cls: "border border-zinc-300/30 bg-zinc-300/10 text-zinc-100" },
  elevated: { label: "Elevated", cls: "border border-zinc-500/30 bg-zinc-500/15 text-zinc-300" },
  high: { label: "High", cls: "border border-zinc-600/30 bg-zinc-600/15 text-zinc-300" },
  severe: { label: "Severe", cls: "border border-zinc-600/40 bg-zinc-700/20 text-zinc-400" },
};

export default async function ExplorePage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  const profiles = await prisma.traderProfile
    .findMany({
      where: { isPublic: true },
      select: {
        slug: true,
        displayName: true,
        strategy: true,
        instruments: true,
        openToWork: true,
        headline: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { metrics: true },
        },
      },
      orderBy: { displayName: "asc" },
    })
    .catch((error) => {
      console.error("Unable to load public profiles", error);
      return [];
    });

  const cards = profiles
    .map((p) => ({
      p,
      trust: publishedTrustFromMetrics(p.versions[0]?.metrics)?.trust ?? null,
    }))
    // Leaderboard order: highest Transparency Score first; unpublished profiles last.
    .sort((a, b) => (b.trust?.scores.transparency ?? -1) - (a.trust?.scores.transparency ?? -1));

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href={loggedIn ? "/dashboard" : "/"}
            className="text-base font-semibold text-zinc-100"
          >
            <SvanLogo />
          </Link>
          {loggedIn ? (
            <Link
              href="/network"
              className="text-sm font-medium text-zinc-200 hover:text-zinc-100"
            >
              Verified traders
            </Link>
          ) : (
            <Link
              href="/signup"
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-white"
            >
              Join beta
            </Link>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-zinc-800 bg-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(250,250,250,0.055),transparent_55%),linear-gradient(180deg,#080808_0%,#030303_100%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-10 sm:py-12">
          <p className="inline-flex items-center gap-2 rounded-full border border-zinc-500/50 bg-white/5 px-3 py-1 text-xs font-medium uppercase text-zinc-200">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Verified directory
          </p>
          <h1 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">
            Traders with proof, context, and a visible record.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
            Browse TrustSVAN profiles by strategy, proof level, risk context, and performance
            snapshot before starting a diligence conversation.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:py-12">
        {cards.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-400">No public research profiles yet.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ p, trust }, i) => {
              const sev = trust ? SEVERITY[trust.drawdownSeverity] : null;
              const proof = trust ? PROOF_LEVELS[trust.proofLevel] : null;
              return (
                <Link
                  key={p.slug}
                  href={`/p/${p.slug}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-900/70 p-5 transition hover:border-zinc-400 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold tabular-nums text-zinc-300">
                        {i + 1}
                      </span>
                      <h3 className="truncate font-semibold text-white">{p.displayName}</h3>
                    </div>
                    {p.openToWork && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-300/40 bg-zinc-300/10 px-2 py-0.5 text-[10px] font-medium text-zinc-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-200" aria-hidden="true" />
                        Open to work
                      </span>
                    )}
                  </div>
                  {proof && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-zinc-500/50 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-200">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Verified · Proof L{trust!.proofLevel}
                    </span>
                  )}
                  <p className="mt-1.5 truncate text-sm text-zinc-400">
                    {p.headline || [p.strategy, p.instruments].filter(Boolean).join(" / ") || "Trader"}
                  </p>

                  {trust ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Mini
                        label="Growth"
                        value={
                          trust.metrics.returnPct != null
                            ? formatPercent(trust.metrics.returnPct, 0)
                            : "-"
                        }
                      />
                      <Mini label="Drop" value={`${trust.metrics.maxDrawdownPct.toFixed(0)}%`} />
                      <Mini label="Trust" value={`${trust.scores.transparency}`} />
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-zinc-400">No published record yet</p>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    {sev && (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${sev.cls}`}>
                        {sev.label} risk
                      </span>
                    )}
                    <span className="ml-auto text-sm font-medium text-zinc-200">View profile</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-zinc-400">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}
