import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PROOF_LEVELS, type DrawdownSeverity } from "@/lib/trust";
import { formatPercent } from "@/lib/format";
import { publishedTrustFromMetrics } from "@/lib/published-profile";

export const metadata: Metadata = { title: "Verified traders - Quantidive" };

const SEVERITY: Record<DrawdownSeverity, { label: string; cls: string }> = {
  controlled: { label: "Controlled", cls: "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  elevated: { label: "Elevated", cls: "border border-amber-400/30 bg-amber-400/10 text-amber-300" },
  high: { label: "High", cls: "border border-orange-400/30 bg-orange-400/10 text-orange-300" },
  severe: { label: "Severe", cls: "border border-red-400/30 bg-red-400/10 text-red-300" },
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
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href={loggedIn ? "/dashboard" : "/"}
            className="text-base font-semibold tracking-[0.18em] text-slate-100"
          >
            QUANTI<span className="text-cyan-300">DIVE</span>
          </Link>
          {loggedIn ? (
            <Link
              href="/network"
              className="text-sm font-medium text-cyan-300 hover:text-cyan-100"
            >
              Verified traders
            </Link>
          ) : (
            <Link
              href="/signup"
              className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-cyan-300"
            >
              Join beta
            </Link>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950">
        <Image
          src="/images/quantidive-city-night.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[54%_36%] opacity-35"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.94)_0%,rgba(2,6,23,0.78)_52%,rgba(2,6,23,0.52)_100%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-12">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Verified directory
          </p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Traders with proof, context, and a visible record.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Browse Quantidive profiles by strategy, proof level, risk context, and performance
            snapshot before starting a diligence conversation.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-10">
        {cards.length === 0 ? (
          <p className="mt-8 text-sm text-slate-400">No public research profiles yet.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ p, trust }, i) => {
              const sev = trust ? SEVERITY[trust.drawdownSeverity] : null;
              const proof = trust ? PROOF_LEVELS[trust.proofLevel] : null;
              return (
                <Link
                  key={p.slug}
                  href={`/p/${p.slug}`}
                  className="block rounded-lg border border-slate-800 bg-slate-900/70 p-5 transition hover:border-cyan-400 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold tabular-nums text-slate-300">
                        {i + 1}
                      </span>
                      <h3 className="truncate font-semibold text-white">{p.displayName}</h3>
                    </div>
                    {p.openToWork && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                        Open to work
                      </span>
                    )}
                  </div>
                  {proof && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Verified · Proof L{trust!.proofLevel}
                    </span>
                  )}
                  <p className="mt-1.5 truncate text-sm text-slate-400">
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
                    <p className="mt-4 text-sm text-slate-400">No published record yet</p>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    {sev && (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${sev.cls}`}>
                        {sev.label} risk
                      </span>
                    )}
                    <span className="ml-auto text-sm font-medium text-cyan-300">View profile</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}
