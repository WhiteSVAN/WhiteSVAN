"use client";

import { useActionState } from "react";
import { joinWaitlist } from "./waitlist-actions";

export function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, undefined);

  if (state?.ok) {
    return (
      <p className="rounded-lg bg-zinc-900/70 px-4 py-3 text-sm font-medium text-zinc-100">
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
        placeholder="research@sitename.com"
        className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 shadow-sm focus:border-zinc-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 shadow-sm hover:bg-white disabled:opacity-60"
      >
        {pending ? "Joining..." : "Join the beta"}
      </button>
      {state?.error && (
        <p className="text-sm text-zinc-300 sm:absolute sm:mt-12">{state.error}</p>
      )}
    </form>
  );
}
