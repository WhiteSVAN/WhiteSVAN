/**
 * Coverage-gap detection for a published record. A gap is a stretch of calendar
 * days between two consecutive recorded trading days that is longer than a
 * normal weekend/holiday break. Gaps are shown factually on the profile — a
 * missing month is context a reviewer needs, not something to hide.
 */

export interface CoverageGap {
  /** Last recorded day before the gap (YYYY-MM-DD). */
  from: string;
  /** First recorded day after the gap (YYYY-MM-DD). */
  to: string;
  /** Calendar days with no records between `from` and `to`. */
  days: number;
}

const DAY_MS = 86_400_000;

function toUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/**
 * @param dates  recorded trading days (YYYY-MM-DD); order and duplicates don't matter
 * @param minGapDays  smallest silent stretch (calendar days) reported as a gap;
 *                    the default 10 skips weekends, long weekends and holiday weeks
 */
export function findCoverageGaps(dates: readonly string[], minGapDays = 10): CoverageGap[] {
  const sorted = [...new Set(dates)].sort();
  const gaps: CoverageGap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const silent = Math.round((toUtc(sorted[i]) - toUtc(sorted[i - 1])) / DAY_MS) - 1;
    if (silent >= minGapDays) gaps.push({ from: sorted[i - 1], to: sorted[i], days: silent });
  }
  return gaps;
}

/** Share of the covered window that falls inside reported gaps (0..1). */
export function gapShare(dates: readonly string[], gaps: readonly CoverageGap[]): number {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length < 2) return 0;
  const span = Math.round((toUtc(sorted.at(-1)!) - toUtc(sorted[0])) / DAY_MS) + 1;
  const missing = gaps.reduce((sum, g) => sum + g.days, 0);
  return span > 0 ? missing / span : 0;
}
