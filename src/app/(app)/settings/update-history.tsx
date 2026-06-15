import { format } from "date-fns";
import { formatMoney } from "@/lib/format";

interface Upload {
  id: string;
  source: string;
  broker: string | null;
  originalFilename: string | null;
  fileHash: string;
  rowCount: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  netPnl: number;
  createdAt: Date;
}

interface Version {
  versionNumber: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  transparencyScore: number;
  proofLevel: number;
  netPnl: number;
  changeSummary: string | null;
  publishedAt: Date;
}

interface Follower {
  email: string;
  status: string;
  frequency: string;
  createdAt: Date;
}

const fmtDate = (d: Date | null) => (d ? format(d, "MMM d, yyyy") : "—");
const periodLabel = (s: Date | null, e: Date | null) =>
  s && e ? `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}` : "—";

/**
 * Trader-facing audit trail (MVP2.2/2.3): every import recorded with a file
 * hash, the immutable published versions, and the follower list.
 */
export function UpdateHistory({
  uploads,
  versions,
  followers,
  queuedCount,
}: {
  uploads: Upload[];
  versions: Version[];
  followers: Follower[];
  queuedCount: number;
}) {
  return (
    <div className="space-y-6">
      {/* Published versions */}
      <div>
        <h3 className="text-sm font-medium text-slate-700">Published versions</h3>
        {versions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No versions published yet. Publish from the dashboard to create an immutable snapshot.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {versions.map((v) => (
              <li key={v.versionNumber} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    v{v.versionNumber}
                    <span className="ml-2 font-normal text-slate-400">
                      {periodLabel(v.periodStart, v.periodEnd)}
                    </span>
                  </span>
                  <span className="text-xs text-slate-400">{fmtDate(v.publishedAt)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                  <span>Net {formatMoney(v.netPnl)}</span>
                  <span>Transparency {v.transparencyScore}/100</span>
                  <span>Proof L{v.proofLevel}</span>
                </div>
                {v.changeSummary && <p className="mt-1 text-xs text-slate-500">{v.changeSummary}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upload history */}
      <div>
        <h3 className="text-sm font-medium text-slate-700">Upload history</h3>
        {uploads.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No imports recorded yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium text-right">Rows</th>
                  <th className="px-3 py-2 font-medium text-right">Net P&amp;L</th>
                  <th className="px-3 py-2 font-medium">Fingerprint</th>
                  <th className="px-3 py-2 font-medium">Imported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploads.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2 text-slate-700">{u.originalFilename || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {u.source}
                      {u.broker ? ` · ${u.broker}` : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {periodLabel(u.periodStart, u.periodEnd)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{u.rowCount}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{formatMoney(u.netPnl)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400" title={u.fileHash}>
                      {u.fileHash.slice(0, 10)}…
                    </td>
                    <td className="px-3 py-2 text-slate-400">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Followers */}
      <div>
        <h3 className="text-sm font-medium text-slate-700">
          Followers{" "}
          <span className="font-normal text-slate-400">
            ({followers.length} · {queuedCount} notification{queuedCount === 1 ? "" : "s"} queued)
          </span>
        </h3>
        {followers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No followers yet. Clients can subscribe from your public profile.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {followers.map((f) => (
              <li
                key={f.email}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <span className="text-slate-700">{f.email}</span>
                <span className="text-xs text-slate-400">
                  {f.frequency.toLowerCase().replace(/_/g, " ")} · {f.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
