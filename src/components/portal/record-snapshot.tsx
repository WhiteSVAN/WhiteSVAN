import type { PublishedTrustSnapshot } from "@/lib/published-profile";
import { ClientView } from "@/components/dashboard/client-view";
import { CalendarHeatmap } from "@/components/dashboard/calendar-heatmap";
import { CoverageGaps } from "@/components/portal/coverage-gaps";
import { HiddenSection } from "@/components/portal/hidden-section";
import { ProvenanceLine } from "@/components/portal/provenance-line";

export const PAST_PERFORMANCE = "Past performance does not guarantee future results.";

/**
 * One published snapshot rendered in full: provenance, metrics + charts,
 * coverage gaps, and the daily calendar. Every figure comes from the stored
 * snapshot — nothing is recomputed from live trades.
 */
export function RecordSnapshot({
  snapshot,
  provenance,
  hideAmounts,
  calendarHidden,
  isOwner,
}: {
  snapshot: PublishedTrustSnapshot;
  provenance: string;
  hideAmounts: boolean;
  calendarHidden: boolean;
  isOwner: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ProvenanceLine text={provenance} />
        <p className="text-xs text-zinc-500">{PAST_PERFORMANCE}</p>
      </div>

      <ClientView
        trust={snapshot.trust}
        equitySeries={snapshot.equitySeries}
        dailySeries={snapshot.dailySeries}
        hideAmounts={hideAmounts}
      />

      <CoverageGaps dates={snapshot.dailySeries.map((d) => d.date)} />

      {calendarHidden ? (
        <HiddenSection title="Daily calendar" isOwner={isOwner} />
      ) : (
        <CalendarHeatmap data={snapshot.dailySeries} hideAmounts={hideAmounts} />
      )}
    </div>
  );
}
