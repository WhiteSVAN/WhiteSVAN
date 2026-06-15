import type { FreshnessTone } from "@/lib/freshness";

const TONE: Record<FreshnessTone, string> = {
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  bad: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

const SEVERITY: Record<string, { ring: string; label: string }> = {
  INFO: { ring: "border-slate-200", label: "text-slate-500" },
  WARNING: { ring: "border-amber-200 bg-amber-50/40", label: "text-amber-700" },
  CRITICAL: { ring: "border-red-200 bg-red-50/40", label: "text-red-700" },
};

export interface ClientRiskEvent {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
}

/**
 * Public "living profile" header (MVP2): freshness badge + last-updated, the
 * change summary since the prior version, and client-visible risk-event cards.
 */
export function ProfileTrust({
  freshness,
  lastUpdatedLabel,
  cadenceLabel,
  changeSummary,
  riskEvents,
}: {
  freshness: { label: string; blurb: string; tone: FreshnessTone };
  lastUpdatedLabel: string | null;
  cadenceLabel: string;
  changeSummary: string | null;
  riskEvents: ClientRiskEvent[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[freshness.tone]}`}
          title={freshness.blurb}
        >
          {freshness.label}
        </span>
        <span className="text-sm text-slate-500">
          {lastUpdatedLabel ? `Last updated ${lastUpdatedLabel}` : "Not yet published"}
          <span className="text-slate-300"> · </span>
          {cadenceLabel} updates
        </span>
      </div>

      {changeSummary && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Since last update
          </h3>
          <p className="mt-1 text-sm text-slate-700">{changeSummary}</p>
        </div>
      )}

      {riskEvents.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">Risk events</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {riskEvents.map((e) => {
              const s = SEVERITY[e.severity] ?? SEVERITY.INFO;
              return (
                <li key={e.id} className={`rounded-xl border p-3 ${s.ring}`}>
                  <p className={`text-sm font-medium ${s.label}`}>{e.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{e.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
