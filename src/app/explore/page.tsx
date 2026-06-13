import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeTrustMetrics, type DrawdownSeverity } from "@/lib/trust";
import { accountProofLevel } from "@/lib/proof";
import { toISODate, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Explore traders — TrustSVAN" };

const SEVERITY: Record<DrawdownSeverity, { label: string; cls: string }> = {
  controlled: { label: "Controlled", cls: "bg-emerald-50 text-emerald-700" },
  elevated: { label: "Elevated", cls: "bg-amber-50 text-amber-700" },
  high: { label: "High", cls: "bg-orange-50 text-orange-700" },
  severe: { label: "Severe", cls: "bg-red-50 text-red-700" },
};

export default async function ExplorePage() {
  const profiles = await prisma.traderProfile.findMany({
    where: { isPublic: true },
    select: { slug: true, displayName: true, strategy: true, instruments: true, userId: true },
    orderBy: { displayName: "asc" },
  });

  const cards = await Promise.all(
    profiles.map(async (p) => {
      const account = await prisma.tradingAccount.findFirst({
        where: { userId: p.userId },
        select: { id: true, startingBalance: true },
        orderBy: { createdAt: "asc" },
      });
      if (!account) return { p, trust: null };
      const days = await prisma.dailyPnl.findMany({
        where: { accountId: account.id },
        select: { tradeDate: true, netPnl: true },
        orderBy: { tradeDate: "asc" },
      });
      if (days.length === 0) return { p, trust: null };
      const series = days.map((d) => ({ date: toISODate(d.tradeDate), netPnl: Number(d.netPnl) }));
      const proofLevel = await accountProofLevel(account.id, true);
      return { p, trust: computeTrustMetrics(series, Number(account.startingBalance), proofLevel) };
    }),
  );

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-base font-semibold tracking-tight text-slate-900">
            Trust<span className="text-blue-700">SVAN</span>
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Explore traders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Public trader portals — review records the way an allocator or a peer would.
        </p>

        {cards.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No public portals yet.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ p, trust }) => {
              const sev = trust ? SEVERITY[trust.drawdownSeverity] : null;
              return (
                <Link
                  key={p.slug}
                  href={`/p/${p.slug}`}
                  className="block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <h3 className="font-semibold text-slate-900">{p.displayName}</h3>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {[p.strategy, p.instruments].filter(Boolean).join(" · ") || "Trader"}
                  </p>

                  {trust ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Mini
                        label="Growth"
                        value={
                          trust.metrics.returnPct != null
                            ? formatPercent(trust.metrics.returnPct, 0)
                            : "—"
                        }
                      />
                      <Mini label="Drop" value={`${trust.metrics.maxDrawdownPct.toFixed(0)}%`} />
                      <Mini label="Trust" value={`${trust.scores.transparency}`} />
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">No published data yet</p>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    {sev && (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${sev.cls}`}>
                        {sev.label} risk
                      </span>
                    )}
                    <span className="ml-auto text-sm font-medium text-blue-700">View portal →</span>
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
