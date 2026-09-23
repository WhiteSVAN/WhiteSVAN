import { ShieldCheck } from "lucide-react";
import type { FreshnessTone } from "@/lib/freshness";
import { PROOF_LEVELS, type ProofLevel } from "@/lib/trust";

const TONE: Record<FreshnessTone, string> = {
  good: "bg-zinc-300/10 text-zinc-100 ring-1 ring-inset ring-zinc-300/30",
  warn: "bg-zinc-500/15 text-zinc-300 ring-1 ring-inset ring-zinc-500/30",
  bad: "bg-zinc-700/20 text-zinc-400 ring-1 ring-inset ring-zinc-600/35",
  neutral: "bg-zinc-800 text-zinc-300 ring-1 ring-inset ring-zinc-700",
};

// Legacy levels map to factual source states. The number is intentionally never
// shown because an uploaded file is not the same as independent verification.
const PROOF_BADGE: Record<ProofLevel, string> = {
  1: "bg-zinc-800 text-zinc-300 ring-1 ring-inset ring-zinc-700",
  2: "bg-zinc-800 text-zinc-300 ring-1 ring-inset ring-zinc-700",
  3: "bg-white/5 text-zinc-200 ring-1 ring-inset ring-zinc-500/30",
  4: "bg-zinc-300/10 text-zinc-100 ring-1 ring-inset ring-zinc-300/30",
  5: "bg-zinc-300/10 text-zinc-100 ring-1 ring-inset ring-zinc-300/30",
};

const SEVERITY: Record<string, { ring: string; label: string }> = {
  INFO: { ring: "border-zinc-800 bg-zinc-900/70", label: "text-zinc-300" },
  WARNING: { ring: "border-zinc-500/30 bg-zinc-500/15", label: "text-zinc-300" },
  CRITICAL: { ring: "border-zinc-600/40 bg-zinc-700/20", label: "text-zinc-400" },
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
      <div className="terminal-card flex flex-wrap items-center gap-3 p-4">
        {proofLevel != null && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${PROOF_BADGE[proofLevel]}`}
            title={PROOF_LEVELS[proofLevel].blurb}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {PROOF_LEVELS[proofLevel].label}
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[freshness.tone]}`}
          title={freshness.blurb}
        >
          {freshness.label}
        </span>
        <span className="text-sm text-zinc-400">
          {lastUpdatedLabel ? `Last updated ${lastUpdatedLabel}` : "Not yet published"}
          <span className="text-zinc-600"> / </span>
          {cadenceLabel} updates
        </span>
      </div>

      {changeSummary && (
        <div className="terminal-card p-4">
          <h3 className="text-xs font-medium uppercase text-zinc-400">
            Since last update
          </h3>
          <p className="mt-1 text-sm text-zinc-300">{changeSummary}</p>
        </div>
      )}

      {riskEvents.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase text-zinc-400">Risk events</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {riskEvents.map((e) => {
              const s = SEVERITY[e.severity] ?? SEVERITY.INFO;
              return (
                <li key={e.id} className={`rounded-xl border p-3 ${s.ring}`}>
                  <p className={`text-sm font-medium ${s.label}`}>{e.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{e.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
