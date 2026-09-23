/**
 * Profile-version diffing — the "what changed since the last publish?" core.
 *
 * Pure and dependency-free. A published `ProfileVersion` is an immutable snapshot;
 * `diffVersions` compares the snapshot about to be published against the previous
 * one. The numeric deltas here drive the publish preview (MVP2.2) and feed the
 * plain-English change summary + risk events (MVP2.3).
 */

/** The comparable fields of a published version. */
export interface VersionSnapshot {
  netPnl: number;
  /** Simple return over starting balance, as a fraction (0.12 = 12%). `null` when unknown. */
  returnPct: number | null;
  /** Largest peak-to-trough decline, percent of running peak (0..100). */
  maxDrawdownPct: number;
  /** ISO `YYYY-MM-DD` last day of coverage, or null. */
  periodEnd: string | null;
}

export interface VersionDiff {
  /** No previous version — this is the first publish. */
  isFirst: boolean;
  netPnlDelta: number;
  /** `null` when either side's return is unknown. */
  returnPctDelta: number | null;
  /** Positive = drawdown got worse (deeper). */
  drawdownPctDelta: number;
  /** Coverage extended to newer days since the prior version. */
  newDaysCovered: boolean;
}

/** Compare the snapshot being published against the previous one (or null = first). */
export function diffVersions(prev: VersionSnapshot | null, next: VersionSnapshot): VersionDiff {
  if (!prev) {
    return {
      isFirst: true,
      netPnlDelta: next.netPnl,
      returnPctDelta: next.returnPct,
      drawdownPctDelta: next.maxDrawdownPct,
      newDaysCovered: next.periodEnd != null,
    };
  }
  return {
    isFirst: false,
    netPnlDelta: next.netPnl - prev.netPnl,
    returnPctDelta:
      next.returnPct != null && prev.returnPct != null ? next.returnPct - prev.returnPct : null,
    drawdownPctDelta: next.maxDrawdownPct - prev.maxDrawdownPct,
    newDaysCovered: next.periodEnd != null && (prev.periodEnd == null || next.periodEnd > prev.periodEnd),
  };
}

/** True when publishing now would actually change the public record. */
export function hasMeaningfulChange(diff: VersionDiff): boolean {
  if (diff.isFirst) return true;
  return (
    Math.abs(diff.netPnlDelta) >= 0.01 ||
    Math.abs(diff.drawdownPctDelta) >= 0.01 ||
    diff.newDaysCovered
  );
}
