import Link from "next/link";
import { History } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { redactText } from "@/lib/redaction";
import { publishedTrustFromMetrics } from "@/lib/published-profile";
import { toRecordContext } from "@/lib/record-context";
import {
  coverageRange,
  formatDay,
  importRows,
  pairedFigures,
  profileHref,
  provenanceLine,
} from "@/lib/profile-page";
import { CoverageGaps } from "@/components/portal/coverage-gaps";
import { EvidenceList } from "@/components/portal/evidence-list";
import { HiddenSection } from "@/components/portal/hidden-section";
import { ImportHistory } from "@/components/portal/import-history";
import { RecordSnapshot } from "@/components/portal/record-snapshot";
import { VersionHistory, type VersionHistoryItem } from "@/components/portal/version-history";
import {
  getImportHistory,
  getPrivateTerms,
  getVersionList,
  getVersionSnapshot,
  type VersionSummaryRow,
  type ViewableProfile,
} from "./data";

/**
 * Proof history: every published version (each viewable as its own stored
 * snapshot), coverage gaps, the source-import audit trail, and evidence metadata.
 */
export async function ProofTab({
  view,
  latest,
  requestedVersion,
}: {
  view: ViewableProfile;
  latest: VersionSummaryRow | null;
  requestedVersion: number | null;
}) {
  const { profile, hidden, isOwner } = view;
  const historyHidden = hidden.has("history");
  const performanceHidden = hidden.has("performance");
  const evidenceHidden = hidden.has("evidence");

  const targetNumber = historyHidden ? null : (requestedVersion ?? latest?.versionNumber ?? null);

  const [versions, imports, evidence, terms, target] = await Promise.all([
    historyHidden ? Promise.resolve([]) : getVersionList(profile.id),
    historyHidden ? Promise.resolve(null) : getImportHistory(profile.userId),
    evidenceHidden
      ? Promise.resolve([])
      : prisma.evidence.findMany({
          where: { userId: profile.userId, isPublic: true },
          select: { id: true, kind: true, label: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
    profile.hideBrokers ? getPrivateTerms(profile.userId) : Promise.resolve([] as string[]),
    targetNumber != null ? getVersionSnapshot(profile.id, targetNumber) : Promise.resolve(null),
  ]);

  const redact = (text: string) => redactText(text, { hideAmounts: profile.hideAmounts, terms });
  const snapshot = target ? publishedTrustFromMetrics(target.metrics) : null;
  const targetRecord = target ? toRecordContext(target) : null;
  const isLatestTarget = target != null && target.versionNumber === latest?.versionNumber;

  const items: VersionHistoryItem[] = versions.map((v) => {
    const ctx = toRecordContext(v);
    return {
      id: v.id,
      versionNumber: v.versionNumber,
      source: ctx.source,
      coverage: coverageRange(ctx.coverageStart, ctx.coverageEnd),
      publishedAt: formatDay(v.publishedAt),
      figures: pairedFigures({ performanceHidden, returnPct: v.returnPct, maxDrawdownPct: v.maxDrawdownPct }),
      netResult: performanceHidden || profile.hideAmounts ? null : formatMoney(Number(v.netPnl)),
      href: performanceHidden ? null : profileHref(profile.slug, "proof", v.versionNumber),
      changeSummary: !performanceHidden && v.changeSummary ? redact(v.changeSummary) : null,
    };
  });

  const evidenceItems = evidence.map((e) => ({ ...e, label: e.label ? redact(e.label) : null }));

  return (
    <div className="space-y-6">
      {historyHidden ? (
        <HiddenSection title="Published version history" isOwner={isOwner} />
      ) : (
        <>
          {requestedVersion != null && !target && (
            <div className="terminal-card p-5 text-sm text-zinc-300" role="status">
              Version {requestedVersion} was not found on this profile.{" "}
              <Link href={profileHref(profile.slug, "proof")} scroll={false} className="text-[#baf277] hover:underline">
                Show the latest version
              </Link>
            </div>
          )}

          {requestedVersion != null && target && (
            <section className="space-y-4" aria-labelledby="snapshot-heading">
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 ${
                  isLatestTarget ? "border-[#2b3a2c] bg-[#111711]" : "border-zinc-500/50 bg-zinc-800/50"
                }`}
                role="status"
              >
                <p id="snapshot-heading" className="flex items-center gap-2 text-sm font-medium text-white">
                  <History className="h-4 w-4 text-zinc-300" aria-hidden="true" />
                  Viewing version {target.versionNumber} ({isLatestTarget ? "latest" : "historical"})
                  <span className="font-normal text-zinc-400">· published {formatDay(target.publishedAt)}</span>
                </p>
                {!isLatestTarget && (
                  <Link
                    href={profileHref(profile.slug, "proof")}
                    scroll={false}
                    className="text-xs font-medium text-[#baf277] hover:underline"
                  >
                    Back to the latest version
                  </Link>
                )}
              </div>
              {performanceHidden ? (
                <HiddenSection title={`Version ${target.versionNumber} snapshot`} isOwner={isOwner} />
              ) : snapshot && targetRecord ? (
                <RecordSnapshot
                  snapshot={snapshot}
                  provenance={provenanceLine(targetRecord)}
                  hideAmounts={profile.hideAmounts}
                  calendarHidden={hidden.has("calendar")}
                  isOwner={isOwner}
                />
              ) : (
                <div className="terminal-card border-dashed p-8 text-center text-sm text-zinc-400">
                  This version has no daily results stored.
                </div>
              )}
            </section>
          )}

          {requestedVersion == null && snapshot && target && (
            <CoverageGaps dates={snapshot.dailySeries.map((d) => d.date)} versionNumber={target.versionNumber} />
          )}

          {items.length > 0 ? (
            <VersionHistory
              items={items}
              selectedVersion={target && requestedVersion != null ? target.versionNumber : null}
              performanceHidden={performanceHidden}
            />
          ) : (
            <div className="terminal-card border-dashed p-8 text-center text-sm text-zinc-400">
              No versions have been published yet.
            </div>
          )}

          {imports && (
            <ImportHistory
              rows={importRows(imports.batches, { hideBrokers: profile.hideBrokers })}
              total={imports.count}
              firstImportAt={imports.firstImportAt ? formatDay(imports.firstImportAt) : null}
              latestImportAt={imports.batches[0] ? formatDay(imports.batches[0].createdAt) : null}
            />
          )}
        </>
      )}

      {evidenceHidden ? (
        <HiddenSection title="Attached evidence" isOwner={isOwner} />
      ) : (
        <EvidenceList items={evidenceItems} />
      )}
    </div>
  );
}
