import type { AiReport } from "@/lib/ai/schema";
import { redactReport } from "@/lib/redaction";

function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** Read-only render of a published AI brief. */
export function ReportSections({
  period,
  report,
  hideAmounts,
  redactTerms,
}: {
  period: string;
  report: AiReport;
  hideAmounts?: boolean;
  redactTerms?: string[];
}) {
  const renderedReport =
    hideAmounts || (redactTerms && redactTerms.length > 0)
      ? redactReport(report, { hideAmounts, terms: redactTerms })
      : report;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-base font-semibold text-slate-900">{periodLabel(period)}</h3>
      {(hideAmounts || (redactTerms && redactTerms.length > 0)) && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          This narrative is redacted to match the profile&apos;s public privacy settings.
        </p>
      )}
      <div className="mt-4 space-y-4">
        <Prose title="Summary" text={renderedReport.executive_summary} />
        <Prose title="Performance" text={renderedReport.performance_summary} />
        <Prose title="Risk" text={renderedReport.risk_summary} />
        <Prose title="Discipline" text={renderedReport.discipline_review} />
        {renderedReport.notable_days.length > 0 && <Bullets title="Notable days" items={renderedReport.notable_days} />}
        {renderedReport.warnings.length > 0 && <Bullets title="Warnings" items={renderedReport.warnings} />}
      </div>
      {renderedReport.client_disclaimer && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
          {renderedReport.client_disclaimer}
        </p>
      )}
    </article>
  );
}

function Prose({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</h4>
      <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
