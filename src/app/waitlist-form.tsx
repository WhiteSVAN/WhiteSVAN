"use client";

import { useActionState, useId } from "react";
import { ArrowRight, Check } from "lucide-react";
import { joinWaitlist } from "./waitlist-actions";

/** Launch-list signup: evaluations are not on sale yet, so this is the conversion point. */
export function WaitlistForm({ defaultEmail, cta = "Notify me" }: { defaultEmail?: string; cta?: string }) {
  const [state, action, pending] = useActionState(joinWaitlist, undefined);
  const id = useId();

  if (state?.ok) {
    return (
      <p role="status" className="inline-flex items-center gap-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--card-raised)] px-4 py-3 text-sm">
        <Check size={16} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
        You&apos;re on the launch list. We&apos;ll email you when evaluations open.
      </p>
    );
  }

  return (
    <form action={action} className="w-full max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">Email address</label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="you@example.com"
          aria-describedby={state?.error ? `${id}-error` : undefined}
          className="min-h-12 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--card-deep)] px-4 text-sm text-[var(--foreground)] placeholder:text-[var(--faint)] focus:border-[var(--primary)] focus:outline-none"
        />
        <button type="submit" disabled={pending} className="prop-button disabled:opacity-60">
          {pending ? "Joining…" : cta} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      {state?.error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-left text-xs text-[var(--danger)]">{state.error}</p>
      )}
    </form>
  );
}
