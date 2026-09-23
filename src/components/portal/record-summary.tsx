import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { RecordContext } from "@/lib/record-context";
import type { FreshnessTone } from "@/lib/freshness";
import { coverageRange, formatDay } from "@/lib/profile-page";

const TONE: Record<FreshnessTone, string> = {
  good: "border-[#57733a] bg-[#1a2418] text-[#dff5c4]",
  warn: "border-zinc-500/40 bg-zinc-500/15 text-zinc-200",
  bad: "border-zinc-600/50 bg-zinc-700/20 text-zinc-400",
  neutral: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="terminal-label">{label}</dt>
      <dd className="mt-1 break-words text-sm text-zinc-200">{children}</dd>
    </div>
  );
}

/**
 * Factual summary of the published record: where it came from, whether anyone
 * independent reviewed it, what it covers, when the source last changed, and
 * whether the trader is keeping to their own update cadence. No scores.
 */
export function RecordSummary({
  record,
  lastImport,
  freshness,
  cadence,
  proofHref,
}: {
  record: RecordContext | null;
  lastImport: { createdAt: Date; periodEnd: Date | null } | null;
  freshness: { label: string; blurb: string; tone: FreshnessTone };
  cadence: string;
  proofHref: string;
}) {
  return (
    <section className="terminal-card p-5" aria-labelledby="record-summary-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="record-summary-heading" className="flex items-center gap-2 text-base font-medium text-white">
          <ShieldCheck className="h-4 w-4 text-[#8fb86a]" aria-hidden="true" />
          Record summary
        </h2>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[freshness.tone]}`}
          title={freshness.blurb}
        >
          {freshness.label}
        </span>
      </div>

      {record ? (
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Row label="Verification source">{record.source}</Row>
          <Row label="Review status">{record.reviewStatus}</Row>
          <Row label="Coverage period">
            {coverageRange(record.coverageStart, record.coverageEnd)}
            {record.months != null && (
              <span className="text-zinc-500">
                {" "}
                · {record.months} month{record.months === 1 ? "" : "s"}
              </span>
            )}
          </Row>
          <Row label="Last source update">
            {lastImport ? (
              <>
                {formatDay(lastImport.createdAt)}
                {lastImport.periodEnd && (
                  <span className="text-zinc-500"> · data through {formatDay(lastImport.periodEnd)}</span>
                )}
              </>
            ) : (
              <span className="text-zinc-400">No source import on file</span>
            )}
          </Row>
          <Row label="Latest published version">
            Version {record.versionNumber}
            <span className="text-zinc-500"> · published {formatDay(record.publishedAt)}</span>
          </Row>
          <Row label="Update cadence">
            {cadence}
            <span className="text-zinc-500"> · {freshness.blurb}</span>
          </Row>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">
          No record has been published yet. Nothing on this profile has been computed from source data.
        </p>
      )}

      {record && (
        <p className="mt-4 text-xs text-zinc-500">
          Uploaded files are not independently verified unless the review status says so.{" "}
          <Link href={proofHref} className="text-[#baf277] hover:underline">
            See proof history
          </Link>
        </p>
      )}
    </section>
  );
}
