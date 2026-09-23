import { publishedTrustFromMetrics } from "@/lib/published-profile";
import { toRecordContext } from "@/lib/record-context";
import { provenanceLine } from "@/lib/profile-page";
import { HiddenSection } from "@/components/portal/hidden-section";
import { RecordSnapshot } from "@/components/portal/record-snapshot";
import { getVersionSnapshot, type VersionSummaryRow, type ViewableProfile } from "./data";

function EmptyRecord({ text }: { text: string }) {
  return <div className="terminal-card border-dashed p-10 text-center text-sm text-zinc-400">{text}</div>;
}

/** Performance: the latest published snapshot, with its provenance directly above the numbers. */
export async function PerformanceTab({ view, latest }: { view: ViewableProfile; latest: VersionSummaryRow | null }) {
  const { profile, hidden, isOwner } = view;
  if (hidden.has("performance")) return <HiddenSection title="Performance charts & metrics" isOwner={isOwner} />;
  if (!latest) return <EmptyRecord text="No published record yet." />;

  const row = await getVersionSnapshot(profile.id, latest.versionNumber);
  const snapshot = row ? publishedTrustFromMetrics(row.metrics) : null;
  if (!row || !snapshot) {
    return <EmptyRecord text="The latest published version has no daily results to chart." />;
  }

  const record = toRecordContext(row);
  return (
    <RecordSnapshot
      snapshot={snapshot}
      provenance={provenanceLine(record)}
      hideAmounts={profile.hideAmounts}
      calendarHidden={hidden.has("calendar")}
      isOwner={isOwner}
    />
  );
}
