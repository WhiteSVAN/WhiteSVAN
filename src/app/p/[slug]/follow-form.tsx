"use client";

import { useActionState } from "react";
import { followProfile } from "./actions";

/**
 * Follow form (MVP2.5) captures update/risk-change notification subscribers.
 * Deliberately advice-free: it offers updates about a *reporting* profile, not a
 * recommendation to invest or copy trades.
 */
export function FollowForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(followProfile, undefined);

  if (state?.ok) {
    return (
      <p className="rounded-lg bg-zinc-900/70 px-4 py-3 text-sm text-zinc-100">
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
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
        <select
          name="frequency"
          defaultValue="MONTHLY"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        >
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="RISK_CHANGES_ONLY">Risk changes only</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Following..." : "Follow"}
        </button>
      </div>
      <p className="text-xs text-zinc-400">
        Get notified when this profile updates or a risk flag changes. Research updates only, not
        investment advice, and you can unsubscribe anytime.
      </p>
      {state?.error && <p className="text-sm text-zinc-300">{state.error}</p>}
    </form>
  );
}
