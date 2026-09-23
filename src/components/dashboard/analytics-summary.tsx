import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatRate } from "@/lib/analytics";
import type { ProfileAnalytics } from "@/app/(app)/analytics/load";

/** Trader dashboard: last-30-day reach of the public record, linking to /analytics. */
export function AnalyticsSummary({ analytics: a }: { analytics: ProfileAnalytics }) {
  const stats = [
    { label: `Views · ${a.days}d`, value: String(a.viewers.views) },
    { label: "Unique viewers", value: String(a.viewers.uniqueViewers) },
    {
      label: "Followers",
      value: String(a.followers.total),
      sub: a.followers.inWindow > 0 ? `+${a.followers.inWindow} new` : undefined,
    },
    { label: `Requests · ${a.days}d`, value: String(a.inquiries.total) },
    { label: "Conversion", value: formatRate(a.conversion), sub: "requests ÷ viewers" },
  ];

  return (
    <section className="terminal-card flex flex-col p-5" aria-labelledby="analytics-summary">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="analytics-summary" className="text-base font-medium text-zinc-800">
          Profile reach
        </h2>
        <Link href="/analytics" className="inline-flex items-center gap-1 text-xs text-[#baf277] hover:underline">
          Full analytics <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
      <p className="mt-1 text-xs text-zinc-500">Last {a.days} days. Private to you.</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <dt className="truncate text-[10px] uppercase tracking-wide text-zinc-500">{s.label}</dt>
            <dd className="mt-1 font-mono text-lg text-white">
              {s.value}
              {s.sub && <span className="ml-1.5 text-[10px] text-zinc-500">{s.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
