import { CalendarX2 } from "lucide-react";
import { findCoverageGaps, gapShare } from "@/lib/coverage";
import { formatDay, gapSummary } from "@/lib/profile-page";

const MIN_GAP_DAYS = 10;

/**
 * Stretches of the published record with no recorded trading days, listed
 * factually. A reviewer needs to know a month is missing; the record can't say
 * whether it was a break or missing data, so neither can we.
 */
export function CoverageGaps({ dates, versionNumber }: { dates: readonly string[]; versionNumber?: number }) {
  const gaps = findCoverageGaps(dates, MIN_GAP_DAYS);
  const share = gapShare(dates, gaps);

  return (
    <section className="terminal-card p-5" aria-labelledby="coverage-gaps-heading">
      <h2 id="coverage-gaps-heading" className="flex items-center gap-2 text-sm font-medium text-white">
        <CalendarX2 className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        Coverage gaps
        {versionNumber != null && <span className="font-normal text-zinc-500">· version {versionNumber}</span>}
      </h2>
      <p className="mt-1 text-sm text-zinc-300">
        {gapSummary(gaps, MIN_GAP_DAYS)}
        {gaps.length > 0 && (
          <span className="text-zinc-500"> · {Math.round(share * 100)}% of the covered window</span>
        )}
      </p>
      {gaps.length > 0 && (
        <ul className="mt-3 divide-y divide-zinc-800 rounded-md border border-zinc-800">
          {gaps.map((gap) => (
            <li
              key={`${gap.from}-${gap.to}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
            >
              <span className="text-zinc-300">
                No records between {formatDay(gap.from)} and {formatDay(gap.to)}
              </span>
              <span className="font-mono text-xs text-zinc-400">
                {gap.days} day{gap.days === 1 ? "" : "s"} missing
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        A gap is more than {MIN_GAP_DAYS} calendar days between two recorded trading days. It may be a break,
        a holiday, or data that was not imported — the record does not say which.
      </p>
    </section>
  );
}
