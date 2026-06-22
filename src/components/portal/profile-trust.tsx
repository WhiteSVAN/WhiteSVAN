import { ShieldCheck } from "lucide-react";
import type { FreshnessTone } from "@/lib/freshness";
import { PROOF_LEVELS, type ProofLevel } from "@/lib/trust";

const TONE: Record<FreshnessTone, string> = {
  good: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30",
  warn: "bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/30",
  bad: "bg-red-400/10 text-red-300 ring-1 ring-inset ring-red-400/30",
  neutral: "bg-slate-800 text-slate-300 ring-1 ring-inset ring-slate-700",
};

// Proof Level badge styling. Tax-return (4) and third-party (5) are the strongest
// proof, so they read as fully verified; statement (3) is checked; CSV/self (1-2)
// are muted. Drives the headline "verification" badge on the public operator card.
const PROOF_BADGE: Record<ProofLevel, string> = {
  1: "bg-slate-800 text-slate-300 ring-1 ring-inset ring-slate-700",
  2: "bg-slate-800 text-slate-300 ring-1 ring-inset ring-slate-700",
  3: "bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/30",
  4: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30",
  5: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30",
};

const SEVERITY: Record<string, { ring: string; label: string }> = {
  INFO: { ring: "border-slate-800 bg-slate-900/70", label: "text-slate-300" },
  WARNING: { ring: "border-amber-400/30 bg-amber-400/10", label: "text-amber-300" },
  CRITICAL: { ring: "border-red-400/30 bg-red-400/10", label: "text-red-300" },
};

export interface ClientRiskEvent {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
}

/**
 * Public research-profile header: freshness badge, last-updated label, change
 * summary since the prior version, and visible risk-event cards.
 */
export function ProfileTrust({
  freshness,
  lastUpdatedLabel,
  cadenceLabel,
  changeSummary,
  riskEvents,
  proofLevel,
}: {
  freshness: { label: string; blurb: string; tone: FreshnessTone };
  lastUpdatedLabel: string | null;
  cadenceLabel: string;
  changeSummary: string | null;
  riskEvents: ClientRiskEvent[];
  proofLevel: ProofLevel | null;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        {proofLevel != null && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${PROOF_BADGE[proofLevel]}`}
            title={PROOF_LEVELS[proofLevel].blurb}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Proof L{proofLevel} · {PROOF_LEVELS[proofLevel].label}
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[freshness.tone]}`}
          title={freshness.blurb}
        >
          {freshness.label}
        </span>
        <span className="text-sm text-slate-400">
          {lastUpdatedLabel ? `Last updated ${lastUpdatedLabel}` : "Not yet published"}
          <span className="text-slate-600"> / </span>
          {cadenceLabel} updates
        </span>
      </div>

      {changeSummary && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Since last update
          </h3>
          <p className="mt-1 text-sm text-slate-300">{changeSummary}</p>
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
                  <p className="mt-0.5 text-xs text-slate-400">{e.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
