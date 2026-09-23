/**
 * Factual record context shown beside a trader's name (posts, rosters, cards):
 * source · coverage · version. Never a score. Server-safe.
 */
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { coverageLabel, type RecordContext } from "@/lib/record-context";

export function RecordBadge({
  record,
  slug,
  compact = false,
}: {
  record: RecordContext | null | undefined;
  slug?: string;
  compact?: boolean;
}) {
  if (!record) {
    return <span className="text-[10px] text-zinc-500">No published record</span>;
  }
  const body = (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-[#9cad92]">
      <ShieldCheck className="h-3 w-3 shrink-0 text-[#8fb86a]" aria-hidden="true" />
      <span>{record.source}</span>
      <span className="text-zinc-600">·</span>
      <span>{coverageLabel(record)}</span>
      {!compact && (
        <>
          <span className="text-zinc-600">·</span>
          <span>v{record.versionNumber}</span>
          <span className="text-zinc-600">·</span>
          <span>{record.reviewStatus}</span>
        </>
      )}
    </span>
  );
  return slug ? (
    <Link href={`/p/${slug}?tab=proof`} className="hover:underline" title="Open the published record">
      {body}
    </Link>
  ) : (
    body
  );
}
