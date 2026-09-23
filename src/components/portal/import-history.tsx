import { Fingerprint } from "lucide-react";
import type { ImportRow } from "@/lib/profile-page";

/**
 * Audit trail of source imports behind the record: when each file came in,
 * what period it covered, and a sha-256 prefix that lets a reviewer match a
 * file the trader sends them. Filenames are never shown; broker names only
 * when the trader allows it.
 */
export function ImportHistory({
  rows,
  total,
  firstImportAt,
  latestImportAt,
}: {
  rows: ImportRow[];
  total: number;
  firstImportAt: string | null;
  latestImportAt: string | null;
}) {
  return (
    <section className="terminal-card overflow-hidden" aria-labelledby="import-history-heading">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 id="import-history-heading" className="flex items-center gap-2 text-base font-medium text-white">
          <Fingerprint className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          Source imports
        </h2>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          {total === 0
            ? "No source files are on record for this profile."
            : `${total} import${total === 1 ? "" : "s"}${
                firstImportAt && latestImportAt
                  ? firstImportAt === latestImportAt
                    ? ` on ${firstImportAt}`
                    : ` between ${firstImportAt} and ${latestImportAt}`
                  : ""
              }. Each file is fingerprinted with sha-256 when it is imported.`}
        </p>
      </div>
      {rows.length > 0 && (
        <ul className="divide-y divide-zinc-800">
          {rows.map((row) => (
            <li key={row.id} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[1fr_1.3fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-zinc-200">{row.importedAt}</p>
                <p className="text-xs text-zinc-500">
                  {row.source}
                  {row.broker && ` · ${row.broker}`}
                </p>
              </div>
              <div className="min-w-0 text-xs text-zinc-400">
                <p>Covers {row.period}</p>
                <p>
                  {row.rows} trade{row.rows === 1 ? "" : "s"}
                </p>
              </div>
              <p className="font-mono text-[11px] text-zinc-400" title="First 12 characters of the file's sha-256">
                sha-256 {row.hashPrefix}…
              </p>
            </li>
          ))}
        </ul>
      )}
      {total > rows.length && (
        <p className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-500">
          Showing the latest {rows.length} of {total} imports.
        </p>
      )}
    </section>
  );
}
