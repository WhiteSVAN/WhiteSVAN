"use client";

import { useActionState } from "react";
import { followProfile } from "./actions";

/**
 * Follow form (MVP2.5) — clients subscribe to update/risk-change notifications.
 * Deliberately advice-free: it offers updates about a *reporting* profile, not a
 * recommendation to invest or copy trades.
 */
export function FollowForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(followProfile, undefined);

  if (state?.ok) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        You&apos;re on the list. You&apos;ll get this trader&apos;s reporting updates by email.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
        <select
          name="frequency"
          defaultValue="MONTHLY"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        >
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="RISK_CHANGES_ONLY">Risk changes only</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Following…" : "Follow"}
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Get notified when this profile updates or a risk flag changes. Reporting updates only — not
        investment advice, and you can unsubscribe anytime.
      </p>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
