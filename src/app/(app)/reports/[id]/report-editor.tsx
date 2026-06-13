"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { submitReport, deleteReport } from "../actions";
import type { AiReport } from "@/lib/ai/schema";
import { findBannedPhrases } from "@/lib/ai/compliance";
import { inputClass, labelClass } from "@/components/form";

function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function ReportEditor({
  id,
  period,
  status,
  accountName,
  report,
}: {
  id: string;
  period: string;
  status: string;
  accountName: string;
  report: AiReport;
}) {
  const [state, action, pending] = useActionState(submitReport, undefined);
  const [fields, setFields] = useState({
    executive_summary: report.executive_summary,
    performance_summary: report.performance_summary,
    risk_summary: report.risk_summary,
    discipline_review: report.discipline_review,
    client_disclaimer: report.client_disclaimer,
    notable_days: report.notable_days.join("\n"),
    warnings: report.warnings.join("\n"),
  });

  const liveIssues = useMemo(
    () => [...new Set(findBannedPhrases(Object.values(fields).join("\n")))],
    [fields],
  );

  const published = status === "PUBLISHED" || state?.published === true;
  const set = (key: keyof typeof fields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/reports" className="text-sm text-blue-700 hover:text-blue-800">
            ← Reports
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {accountName} · {periodLabel(period)}
          </h1>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {published ? "Published" : "Draft"}
        </span>
      </div>

      {state?.published && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          Report published.
        </div>
      )}
      {state?.saved && (
        <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">Draft saved.</div>
      )}
      {state?.message && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{state.message}</div>
      )}
      {(liveIssues.length > 0 || (state?.issues && state.issues.length > 0)) && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Compliance check — remove before publishing:</p>
          <ul className="mt-1 list-inside list-disc">
            {[...new Set([...liveIssues, ...(state?.issues ?? [])])].map((p) => (
              <li key={p}>
                &ldquo;{p}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={action} className="space-y-5">
        <input type="hidden" name="id" value={id} />

        <Field label="Executive summary" name="executive_summary" rows={3} value={fields.executive_summary} onChange={set("executive_summary")} />
        <Field label="Performance summary" name="performance_summary" rows={4} value={fields.performance_summary} onChange={set("performance_summary")} />
        <Field label="Risk summary" name="risk_summary" rows={4} value={fields.risk_summary} onChange={set("risk_summary")} />
        <Field label="Discipline review" name="discipline_review" rows={4} value={fields.discipline_review} onChange={set("discipline_review")} />
        <Field label="Notable days" name="notable_days" rows={3} value={fields.notable_days} onChange={set("notable_days")} hint="One per line." />
        <Field label="Warnings" name="warnings" rows={3} value={fields.warnings} onChange={set("warnings")} hint="One per line." />
        <Field label="Client disclaimer" name="client_disclaimer" rows={2} value={fields.client_disclaimer} onChange={set("client_disclaimer")} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={pending || liveIssues.length > 0}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            title={liveIssues.length > 0 ? "Resolve compliance issues first" : undefined}
          >
            Publish
          </button>
        </div>
      </form>

      <form action={deleteReport} className="border-t border-slate-100 pt-4">
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="text-sm text-red-600 hover:text-red-700">
          Delete report
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  rows,
  value,
  onChange,
  hint,
}: {
  label: string;
  name: string;
  rows: number;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        value={value}
        onChange={onChange}
        className={inputClass}
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
