import { AlertTriangle, Eye, ShieldCheck, TrendingUp } from "lucide-react";
import type { DiligenceBrief, DiligenceItem, DiligencePosture } from "@/lib/diligence";

const POSTURE_STYLE: Record<DiligencePosture, string> = {
  constructive: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  mixed: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  cautious: "border-red-400/40 bg-red-400/10 text-red-300",
};

const TONE: Record<string, string> = {
  emerald: "text-emerald-300",
  red: "text-red-300",
  steel: "text-zinc-200",
};

function Column({
  title,
  icon: Icon,
  tone,
  items,
  empty,
}: {
  title: string;
  icon: typeof TrendingUp;
  tone: keyof typeof TONE;
  items: DiligenceItem[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
      <h3 className={`flex items-center gap-1.5 text-sm font-medium ${TONE[tone]}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((it) => (
            <li key={it.label}>
              <p className="text-sm font-medium text-zinc-200">{it.label}</p>
              <p className="text-xs leading-5 text-zinc-400">{it.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Allocator due-diligence view of a trader, rendered from a code-built brief. */
export function DiligenceBriefView({ brief }: { brief: DiligenceBrief }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${POSTURE_STYLE[brief.posture]}`}
        >
          {brief.postureLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-500/50 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-zinc-200">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {brief.dataQuality.label} · Proof L{brief.dataQuality.proofLevel}
        </span>
      </div>

      <p className="max-w-3xl text-sm leading-6 text-zinc-400">{brief.summary}</p>

      <div className="grid gap-4 md:grid-cols-3">
        <Column
          title="Strengths"
          icon={TrendingUp}
          tone="emerald"
          items={brief.strengths}
          empty="No standout strengths in the verified record."
        />
        <Column
          title="Risk flags"
          icon={AlertTriangle}
          tone="red"
          items={brief.risks}
          empty="No material risk flags surfaced."
        />
        <Column
          title="What to monitor"
          icon={Eye}
          tone="steel"
          items={brief.watchItems}
          empty="Nothing flagged to monitor."
        />
      </div>
    </section>
  );
}
