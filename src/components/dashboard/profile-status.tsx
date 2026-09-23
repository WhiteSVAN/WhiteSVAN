import { format, parseISO } from "date-fns";
import {
  describeFreshness,
  toCadence,
  cadenceLabel,
  type FreshnessTone,
} from "@/lib/freshness";
import { PROOF_LEVELS, type ProofLevel } from "@/lib/trust";

/** Badge colors by freshness tone. */
const TONE: Record<FreshnessTone, string> = {
  good: "bg-zinc-900/70 text-zinc-100 ring-1 ring-inset ring-zinc-400/20",
  warn: "bg-zinc-900/70 text-zinc-300 ring-1 ring-inset ring-zinc-500/25",
  bad: "bg-zinc-950/80 text-zinc-300 ring-1 ring-inset ring-zinc-600/30",
  neutral: "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/20",
};

/** "2h ago" / "3d ago" / "2mo ago" — coarse, client-readable. */
function relativeAge(hours: number | null): string {
  if (hours == null) return "never";
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-zinc-400">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-800">{children}</dd>
    </div>
  );
}

/**
 * Profile status card (MVP2.1) — the trader-facing "is my trust profile current?"
 * summary: visibility, source provenance, freshness, publication time, and data coverage.
 */
export function ProfileStatusCard({
  isPublic,
  proofLevel,
  cadence,
  lastPublishedAt,
  coverageStart,
  coverageEnd,
}: {
  isPublic: boolean;
  proofLevel: ProofLevel;
  cadence: string;
  lastPublishedAt: Date | null;
  /** ISO `YYYY-MM-DD` bounds of the imported data, or null when no data. */
  coverageStart: string | null;
  coverageEnd: string | null;
}) {
  const c = toCadence(cadence);
  const coverageDate = coverageEnd ? parseISO(coverageEnd) : null;
  const fresh = describeFreshness(c, coverageDate);

  const coverage =
    coverageStart && coverageEnd
      ? `${format(parseISO(coverageStart), "MMM d, yyyy")} – ${format(parseISO(coverageEnd), "MMM d, yyyy")}`
      : "No data yet";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium text-zinc-800">Profile status</h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[fresh.tone]}`}
          title={fresh.blurb}
        >
          {fresh.label}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Visibility">
          <span className={isPublic ? "text-zinc-100" : "text-zinc-500"}>
            {isPublic ? "Public" : "Private"}
          </span>
        </Stat>
        <Stat label="Record source">{PROOF_LEVELS[proofLevel].label}</Stat>
        <Stat label="Cadence">{cadenceLabel(c)}</Stat>
        <Stat label="Coverage updated">
          {relativeAge(fresh.ageHours)}
          {fresh.nextExpectedUpdate && (
            <span className="block text-xs text-zinc-400">
              next due {format(fresh.nextExpectedUpdate, "MMM d")}
            </span>
          )}
        </Stat>
        <Stat label="Published">
          {lastPublishedAt ? format(lastPublishedAt, "MMM d, yyyy") : "Not yet"}
        </Stat>
        <Stat label="Data coverage">{coverage}</Stat>
      </dl>

      <p className="mt-4 text-xs text-zinc-400">{fresh.blurb}</p>
    </section>
  );
}
