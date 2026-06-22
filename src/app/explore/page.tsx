import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { DrawdownSeverity } from "@/lib/trust";
import { formatPercent } from "@/lib/format";
import { publishedTrustFromMetrics } from "@/lib/published-profile";

export const metadata: Metadata = { title: "Researcher directory - Quantidive" };

const SEVERITY: Record<DrawdownSeverity, { label: string; cls: string }> = {
  controlled: { label: "Controlled", cls: "bg-emerald-50 text-emerald-700" },
  elevated: { label: "Elevated", cls: "bg-amber-50 text-amber-700" },
  high: { label: "High", cls: "bg-orange-50 text-orange-700" },
  severe: { label: "Severe", cls: "bg-red-50 text-red-700" },
};

export default async function ExplorePage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  const profiles = await prisma.traderProfile.findMany({
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
  });

  const cards = profiles.map((p) => ({
    p,
    trust: publishedTrustFromMetrics(p.versions[0]?.metrics)?.trust ?? null,
  }));

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
              Network
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

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Researcher directory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Public Quantidive research profiles with strategy, proof level, risk context, and performance snapshots.
        </p>

        {cards.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No public research profiles yet.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ p, trust }) => {
              const sev = trust ? SEVERITY[trust.drawdownSeverity] : null;
              return (
                <Link
                  key={p.slug}
                  href={`/p/${p.slug}`}
                  className="block rounded-lg border border-slate-800 bg-slate-900/70 p-5 transition hover:border-cyan-400 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-semibold text-slate-900">{p.displayName}</h3>
                    {p.openToWork && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                        Open to work
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
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
                    <span className="ml-auto text-sm font-medium text-cyan-300">View card</span>
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
      <p className="mt-0.5 font-semibold tabular-nums text-slate-800">{value}</p>
    </div>
  );
}
