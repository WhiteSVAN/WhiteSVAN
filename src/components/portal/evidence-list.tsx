import { FileText, Lock } from "lucide-react";
import { formatDay } from "@/lib/profile-page";

const KIND_LABEL: Record<string, string> = {
  STATEMENT: "Broker statement",
  TAX_RETURN: "Tax record",
  PAYOUT: "Payout record",
  EXPORT: "Source export",
  OTHER: "Supporting document",
};

export interface EvidenceItem {
  id: string;
  kind: string;
  label: string | null;
  createdAt: Date;
}

/**
 * Metadata for evidence the trader chose to list publicly. Files themselves stay
 * private; attaching a document is not the same as independent review.
 */
export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  return (
    <section className="terminal-card overflow-hidden" aria-labelledby="evidence-heading">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 id="evidence-heading" className="flex items-center gap-2 text-base font-medium text-white">
          <FileText className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          Attached evidence
        </h2>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          Listed documents are attached by the trader. Files are not public, and attaching a document does not
          mean anyone independently verified it.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-zinc-400">No evidence is listed publicly.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {items.map((e) => {
            const kind = KIND_LABEL[e.kind] ?? KIND_LABEL.OTHER;
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="break-words font-medium text-zinc-200">{e.label?.trim() || kind}</p>
                  <p className="text-xs text-zinc-500">
                    {kind} · attached {formatDay(e.createdAt)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  File private
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
