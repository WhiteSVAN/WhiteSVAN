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
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  bad: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
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
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

/**
 * Profile status card (MVP2.1) — the trader-facing "is my trust profile current?"
 * summary: visibility, proof level, freshness badge, last updated, data coverage,
 * and the headline Transparency Score.
 */
export function ProfileStatusCard({
  isPublic,
  proofLevel,
  cadence,
  lastPublishedAt,
  transparencyScore,
  coverageStart,
  coverageEnd,
}: {
  isPublic: boolean;
  proofLevel: ProofLevel;
  cadence: string;
  lastPublishedAt: Date | null;
  transparencyScore: number | null;
  /** ISO `YYYY-MM-DD` bounds of the imported data, or null when no data. */
  coverageStart: string | null;
  coverageEnd: string | null;
}) {
  const c = toCadence(cadence);
  const fresh = describeFreshness(c, lastPublishedAt);

  const coverage =
    coverageStart && coverageEnd
      ? `${format(parseISO(coverageStart), "MMM d, yyyy")} – ${format(parseISO(coverageEnd), "MMM d, yyyy")}`
      : "No data yet";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium text-slate-800">Profile status</h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[fresh.tone]}`}
          title={fresh.blurb}
        >
          {fresh.label}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Visibility">
          <span className={isPublic ? "text-emerald-700" : "text-slate-500"}>
            {isPublic ? "Public" : "Private"}
          </span>
        </Stat>
        <Stat label="Proof level">
          <span className="font-medium">L{proofLevel}</span>{" "}
          <span className="text-slate-500">{PROOF_LEVELS[proofLevel].label}</span>
        </Stat>
        <Stat label="Cadence">{cadenceLabel(c)}</Stat>
        <Stat label="Last updated">
          {relativeAge(fresh.ageHours)}
          {fresh.nextExpectedUpdate && (
            <span className="block text-xs text-slate-400">
              next due {format(fresh.nextExpectedUpdate, "MMM d")}
            </span>
          )}
        </Stat>
        <Stat label="Transparency">
          {transparencyScore != null ? (
            <>
              <span className="font-medium">{transparencyScore}</span>
              <span className="text-slate-400">/100</span>
            </>
          ) : (
            "—"
          )}
        </Stat>
        <Stat label="Data coverage">{coverage}</Stat>
      </dl>

      <p className="mt-4 text-xs text-slate-400">{fresh.blurb}</p>
    </section>
  );
}
