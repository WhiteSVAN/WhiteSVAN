import type { AiReport } from "@/lib/ai/schema";

function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** Read-only render of a published AI report (used on the public portal). */
export function ReportSections({ period, report }: { period: string; report: AiReport }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-base font-semibold text-slate-900">{periodLabel(period)}</h3>
      <div className="mt-4 space-y-4">
        <Prose title="Summary" text={report.executive_summary} />
        <Prose title="Performance" text={report.performance_summary} />
        <Prose title="Risk" text={report.risk_summary} />
        <Prose title="Discipline" text={report.discipline_review} />
        {report.notable_days.length > 0 && <Bullets title="Notable days" items={report.notable_days} />}
        {report.warnings.length > 0 && <Bullets title="Warnings" items={report.warnings} />}
      </div>
      {report.client_disclaimer && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
          {report.client_disclaimer}
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
