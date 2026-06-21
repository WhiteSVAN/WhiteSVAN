"use client";

import { useActionState } from "react";
import { joinWaitlist } from "./waitlist-actions";

export function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, undefined);

  if (state?.ok) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        You&apos;re on the list. We&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <input
        type="email"
        name="email"
        required
        placeholder="desk@sitename.com"
        className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-sm focus:border-cyan-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 shadow-sm hover:bg-cyan-300 disabled:opacity-60"
      >
        {pending ? "Joining..." : "Join the beta"}
      </button>
      {state?.error && (
        <p className="text-sm text-red-400 sm:absolute sm:mt-12">{state.error}</p>
      )}
    </form>
  );
}
