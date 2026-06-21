"use client";

import { useActionState } from "react";
import { publishUpdate } from "@/app/(app)/dashboard/actions";

/**
 * Publish control (MVP2.2) snapshots the trader's current numbers into a new
 * immutable profile version and makes them the live public record. Shows the
 * last published version + its change summary.
 */
export function PublishUpdate({
  lastVersionNumber,
  lastPublishedLabel,
  lastChangeSummary,
}: {
  lastVersionNumber: number | null;
  lastPublishedLabel: string | null;
  lastChangeSummary: string | null;
}) {
  const [state, action, pending] = useActionState(publishUpdate, undefined);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-slate-800">Publish research record</h2>
          <p className="mt-1 text-sm text-slate-500">
            {lastVersionNumber
              ? `Last published: v${lastVersionNumber}${lastPublishedLabel ? ` / ${lastPublishedLabel}` : ""}`
              : "Not published yet. Publish to make your latest numbers visible on your research profile."}
          </p>
        </div>
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Publishing..." : "Publish record"}
          </button>
        </form>
      </div>

      {lastChangeSummary && !state?.published && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {lastChangeSummary}
        </p>
      )}
      {state?.published && (
        <p className="mt-3 text-sm text-emerald-600">
          Published v{state.version}. Your research profile is updated.
        </p>
      )}
      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
