"use client";

import { useActionState } from "react";
import { publishUpdate } from "@/app/(app)/dashboard/actions";

/**
 * Publish control (MVP2.2) snapshots the trader's current numbers into a new
 * immutable profile version and makes them the live public record. Shows the
 * last published version + its change summary.
 */
export function PublishUpdate({
  accountId,
  lastVersionNumber,
  lastPublishedLabel,
  lastChangeSummary,
}: {
  accountId: string;
  lastVersionNumber: number | null;
  lastPublishedLabel: string | null;
  lastChangeSummary: string | null;
}) {
  const [state, action, pending] = useActionState(publishUpdate, undefined);

  return (
    <section className="terminal-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-zinc-800">Publish research record</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {lastVersionNumber
              ? `Last published: v${lastVersionNumber}${lastPublishedLabel ? ` / ${lastPublishedLabel}` : ""}`
              : "Not published yet. Publish to make your latest numbers visible on your research profile."}
          </p>
        </div>
        <form action={action}>
          <input type="hidden" name="accountId" value={accountId} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Publishing..." : "Publish record"}
          </button>
        </form>
      </div>

      {lastChangeSummary && !state?.published && (
        <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          {lastChangeSummary}
        </p>
      )}
      {state?.published && (
        <p className="mt-3 text-sm text-zinc-100" role="status">
          Published v{state.version}. Your research profile is updated.
        </p>
      )}
      {state?.error && <p className="mt-3 text-sm text-zinc-300" role="alert">{state.error}</p>}
    </section>
  );
}
