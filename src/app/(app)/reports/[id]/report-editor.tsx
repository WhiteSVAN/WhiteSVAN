"use client";

import Link from "next/link";
import { type FormEvent, useActionState, useMemo, useState } from "react";
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

  const effectiveStatus = state?.published
    ? "PUBLISHED"
    : state?.approved
      ? "APPROVED"
      : status;
  const readOnly = effectiveStatus === "PUBLISHED";
  const STATUS_BADGE: Record<string, string> = {
    PUBLISHED: "bg-zinc-900/70 text-zinc-100",
    APPROVED: "bg-zinc-900/70 text-zinc-300",
    DRAFT: "bg-zinc-100 text-zinc-500",
  };
  const STATUS_LABEL: Record<string, string> = {
    PUBLISHED: "Published",
    APPROVED: "Approved",
    DRAFT: "Draft",
  };
  const set = (key: keyof typeof fields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/reports" className="text-xs text-zinc-200 hover:text-zinc-100">
            Back to briefs
          </Link>
          <p className="terminal-label mt-4">Brief editor / verified metrics</p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-900">
            {accountName} / {periodLabel(period)}
          </h1>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[effectiveStatus] ?? STATUS_BADGE.DRAFT}`}
        >
          {STATUS_LABEL[effectiveStatus] ?? "Draft"}
        </span>
      </div>

      {state?.published && (
        <div className="rounded-lg bg-zinc-900/70 px-4 py-2 text-sm text-zinc-100">
          Brief published.
        </div>
      )}
      {state?.approved && (
        <div className="rounded-lg bg-zinc-900/70 px-4 py-2 text-sm text-zinc-200">
          Brief approved. Ready to publish.
        </div>
      )}
      {state?.saved && (
        <div className="rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-600">Draft saved.</div>
      )}
      {state?.message && (
        <div className="rounded-lg bg-zinc-950/80 px-4 py-2 text-sm text-zinc-300">{state.message}</div>
      )}
      {(liveIssues.length > 0 || (state?.issues && state.issues.length > 0)) && (
        <div className="rounded-lg bg-zinc-900/70 px-4 py-3 text-sm text-zinc-200">
          <p className="font-medium">Compliance check: remove before publishing:</p>
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

        <Field label="Executive summary" name="executive_summary" rows={3} value={fields.executive_summary} onChange={set("executive_summary")} readOnly={readOnly} />
        <Field label="Performance summary" name="performance_summary" rows={4} value={fields.performance_summary} onChange={set("performance_summary")} readOnly={readOnly} />
        <Field label="Risk summary" name="risk_summary" rows={4} value={fields.risk_summary} onChange={set("risk_summary")} readOnly={readOnly} />
        <Field label="Discipline review" name="discipline_review" rows={4} value={fields.discipline_review} onChange={set("discipline_review")} readOnly={readOnly} />
        <Field label="Notable days" name="notable_days" rows={3} value={fields.notable_days} onChange={set("notable_days")} hint="One per line." readOnly={readOnly} />
        <Field label="Warnings" name="warnings" rows={3} value={fields.warnings} onChange={set("warnings")} hint="One per line." readOnly={readOnly} />
        <Field label="Research disclaimer" name="client_disclaimer" rows={2} value={fields.client_disclaimer} onChange={set("client_disclaimer")} readOnly={readOnly} />

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3">
            {effectiveStatus === "DRAFT" && (
              <>
                <button
                  type="submit"
                  name="intent"
                  value="save"
                  disabled={pending}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-400 hover:bg-zinc-800 disabled:opacity-60"
                >
                  {pending ? "Saving..." : "Save draft"}
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="approve"
                  disabled={pending || liveIssues.length > 0}
                  className="rounded-lg border border-zinc-500 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  title={liveIssues.length > 0 ? "Resolve compliance issues first" : undefined}
                >
                  Approve
                </button>
              </>
            )}
            {effectiveStatus === "APPROVED" && (
              <button
                type="submit"
                name="intent"
                value="publish"
                disabled={pending || liveIssues.length > 0}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                title={liveIssues.length > 0 ? "Resolve compliance issues first" : undefined}
              >
                Publish
              </button>
            )}
          </div>
        )}
      </form>

      <form action={deleteReport} className="border-t border-zinc-100 pt-4" onSubmit={confirmDelete}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="text-sm text-red-400 hover:text-red-300">
          Delete brief
        </button>
      </form>
    </div>
  );
}

function confirmDelete(e: FormEvent<HTMLFormElement>) {
  if (!window.confirm("Delete this report? This can't be undone.")) e.preventDefault();
}

function Field({
  label,
  name,
  rows,
  value,
  onChange,
  hint,
  readOnly,
}: {
  label: string;
  name: string;
  rows: number;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  hint?: string;
  readOnly?: boolean;
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
        readOnly={readOnly}
        className={`${inputClass} ${readOnly ? "bg-zinc-50 text-zinc-600" : ""}`}
      />
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
