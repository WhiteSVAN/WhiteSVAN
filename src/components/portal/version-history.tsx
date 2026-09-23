import Link from "next/link";
import { History } from "lucide-react";

export interface VersionHistoryItem {
  id: string;
  versionNumber: number;
  source: string;
  coverage: string;
  publishedAt: string;
  /** Period return + max drawdown as a pair; null when unknown or performance is hidden. */
  figures: { periodReturn: string; maxDrawdown: string } | null;
  /** Formatted net result, or null when amounts are hidden. */
  netResult: string | null;
  href: string | null;
  changeSummary: string | null;
}

/**
 * Every published version, newest first. Versions are immutable snapshots;
 * publication date and data coverage are shown separately because they differ.
 */
export function VersionHistory({
  items,
  selectedVersion,
  performanceHidden,
}: {
  items: VersionHistoryItem[];
  selectedVersion: number | null;
  performanceHidden: boolean;
}) {
  return (
    <section className="terminal-card overflow-hidden" aria-labelledby="version-history-heading">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 id="version-history-heading" className="flex items-center gap-2 text-base font-medium text-white">
          <History className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          Published versions
          <span className="font-mono text-xs font-normal text-zinc-500">{items.length}</span>
        </h2>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          Each publish is stored as an immutable snapshot. Earlier versions are never edited.
          {performanceHidden && " The trader has hidden performance figures, so results are not listed."}
        </p>
      </div>
      <ol className="divide-y divide-zinc-800">
        {items.map((v) => {
          const selected = selectedVersion === v.versionNumber;
          return (
            <li
              key={v.id}
              className={`grid gap-3 px-5 py-4 text-sm sm:grid-cols-[1.4fr_.8fr_.8fr] sm:items-center ${
                selected ? "bg-[#131b14]" : ""
              }`}
              aria-current={selected ? "true" : undefined}
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-200">
                  Version {v.versionNumber}
                  {selected && (
                    <span className="ml-2 rounded border border-[#57733a] px-1.5 py-0.5 font-mono text-[10px] text-[#dff5c4]">
                      Viewing
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{v.coverage}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {v.source} · Published {v.publishedAt}
                </p>
                {v.changeSummary && <p className="mt-1 text-xs leading-5 text-zinc-400">{v.changeSummary}</p>}
                {v.href && !selected && (
                  <Link
                    href={v.href}
                    scroll={false}
                    className="mt-2 inline-flex text-xs font-medium text-[#baf277] hover:underline"
                  >
                    View this snapshot
                  </Link>
                )}
              </div>
              <div>
                <span className="terminal-label">Period result</span>
                <p className="mt-1 font-mono text-zinc-200">
                  {performanceHidden ? (
                    "Hidden"
                  ) : (
                    <>
                      {v.figures?.periodReturn ?? (v.netResult ? "" : "Not available")}
                      {v.netResult && (
                        <span className={v.figures ? "text-zinc-400" : ""}>
                          {v.figures ? " · " : ""}
                          {v.netResult}
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div>
                <span className="terminal-label">Max drawdown</span>
                <p className="mt-1 font-mono text-zinc-200">
                  {performanceHidden ? "Hidden" : (v.figures?.maxDrawdown ?? "Not available")}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
