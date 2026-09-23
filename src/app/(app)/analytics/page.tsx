import type { Metadata } from "next";
import Link from "next/link";
import { requireTrader } from "@/lib/auth/dal";
import { ANALYTICS_WINDOWS, formatRate, toAnalyticsWindow } from "@/lib/analytics";
import { ProfileViewsChart } from "@/components/charts/profile-views";
import { loadProfileAnalytics } from "./load";

export const metadata: Metadata = { title: "Profile analytics · TrustSVAN" };

// Analytics days are UTC calendar days (ProfileView.day is a @db.Date).
const UTC_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const UTC_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const user = await requireTrader();
  const days = toAnalyticsWindow((await searchParams).days);
  const a = await loadProfileAnalytics(user.profile.id, days);
  const { viewers, inquiries } = a;
  const busiest = a.series.reduce((best, d) => (d.views > best.views ? d : best), a.series[0]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="terminal-label">Record analytics / visible only to you</p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-900">Profile analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Who looked at your public record, and how many of them asked for a conversation.
            Since {UTC_DATE.format(a.since)} (UTC).
          </p>
        </div>
        <nav aria-label="Time window" className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
          {ANALYTICS_WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/analytics?days=${w}`}
              aria-current={w === days ? "page" : undefined}
              className={`rounded-md px-3 py-1 transition ${
                w === days ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {w} days
            </Link>
          ))}
        </nav>
      </div>

      {!user.profile.isPublic && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-zinc-300">
          Your profile is private, so no new views are being recorded.{" "}
          <Link href="/settings#privacy" className="font-medium text-[#baf277] hover:underline">
            Make it public in settings
          </Link>
          .
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Profile views" value={String(viewers.views)} hint="One per visitor per day" />
        <Tile label="Unique viewers" value={String(viewers.uniqueViewers)} hint={`Over ${days} days`} />
        <Tile
          label="Signed-in / anonymous"
          value={`${viewers.signedInViewers} / ${viewers.anonymousViewers}`}
          hint="Unique viewers by type"
        />
        <Tile
          label="Followers"
          value={String(a.followers.total)}
          hint={`+${a.followers.inWindow} in the last ${days} days`}
        />
        <Tile label="Requests received" value={String(inquiries.total)} hint={`In the last ${days} days`} />
        <Tile
          label="Conversion"
          value={formatRate(a.conversion)}
          hint="Requests ÷ unique viewers"
        />
      </div>

      <section className="terminal-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-white">Profile views per day</h2>
            <p className="text-xs text-zinc-400">
              {viewers.views === 0
                ? "No views in this window yet."
                : `Busiest day: ${UTC_DAY.format(new Date(`${busiest.date}T00:00:00Z`))} (${busiest.views} view${busiest.views === 1 ? "" : "s"}).`}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <ProfileViewsChart data={a.series} />
        </div>
        <details className="mt-3 text-xs text-zinc-400">
          <summary className="cursor-pointer hover:text-zinc-200">Show as table</summary>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-zinc-950 font-mono text-[10px] uppercase text-zinc-500">
                <tr>
                  <th scope="col" className="px-3 py-1.5 font-medium">Day</th>
                  <th scope="col" className="px-3 py-1.5 text-right font-medium">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {[...a.series].reverse().map((d) => (
                  <tr key={d.date}>
                    <td className="px-3 py-1 font-mono text-zinc-400">{d.date}</td>
                    <td className="px-3 py-1 text-right tabular-nums text-zinc-300">{d.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="terminal-card p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-white">Conversation requests</h2>
            <Link href="/inbox" className="text-xs text-[#baf277] hover:underline">
              Open inbox
            </Link>
          </div>
          <p className="text-xs text-zinc-400">Received in the last {days} days, by current status.</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatusCount label="Pending" value={inquiries.pending} />
            <StatusCount label="Accepted" value={inquiries.accepted} />
            <StatusCount label="Declined" value={inquiries.declined} />
            <StatusCount label="Ignored" value={inquiries.ignored} />
          </dl>
          <p className="mt-4 text-sm text-zinc-300">
            Acceptance rate{" "}
            <span className="font-mono text-white">{formatRate(inquiries.acceptanceRate)}</span>
            <span className="block text-xs text-zinc-500">
              {inquiries.responded === 0
                ? "Shown once you have answered at least one request."
                : `Accepted ÷ answered (${inquiries.accepted} of ${inquiries.responded}).`}
            </span>
          </p>
        </section>

        <section className="terminal-card p-4 sm:p-5 text-sm text-zinc-400">
          <h2 className="text-sm font-medium text-white">How these numbers are counted</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-5">
            <li>A view is one visitor on one day; repeat visits the same day count once.</li>
            <li>Your own visits to your profile are never counted.</li>
            <li>
              Anonymous visitors are grouped by a salted hash of their network address — no raw IP
              address is stored. Known crawlers are skipped.
            </li>
            <li>Conversion is requests received ÷ unique viewers in the same window.</li>
            <li>These analytics are private to you and never used to rank traders.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="terminal-card min-w-0 p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 truncate font-mono text-2xl text-white">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function StatusCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 font-mono text-lg text-white">{value}</dd>
    </div>
  );
}
