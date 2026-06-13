"use client";

import { useActionState } from "react";
import { joinWaitlist } from "./waitlist-actions";

export function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, undefined);

  if (state?.ok) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        You&apos;re on the list — we&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-600 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join the beta"}
      </button>
      {state?.error && (
        <p className="text-sm text-red-600 sm:absolute sm:mt-12">{state.error}</p>
      )}
    </form>
  );
}
