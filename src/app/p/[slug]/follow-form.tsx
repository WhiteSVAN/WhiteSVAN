"use client";

import { useActionState } from "react";
import { FormError, inputClass } from "@/components/form";
import { followProfile } from "./actions";

const fieldClass = inputClass.replace("mt-2 ", "");

/**
 * Email updates for signed-out visitors (signed-in users use Follow instead).
 * Deliberately advice-free: it offers updates about a *reporting* profile, not a
 * recommendation to invest or copy trades.
 */
export function FollowForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(followProfile, undefined);

  if (state?.ok) {
    return (
      <p className="rounded-md border border-[#2b3a2c] bg-[#111711] px-4 py-3 text-sm text-zinc-100" role="status">
        You&apos;re on the list. You&apos;ll get this trader&apos;s reporting updates by email.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="email-updates-address" className="sr-only">
            Email address
          </label>
          <input
            id="email-updates-address"
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="email-updates-frequency" className="sr-only">
            How often
          </label>
          <select
            id="email-updates-frequency"
            name="frequency"
            defaultValue="MONTHLY"
            className={`${fieldClass} sm:w-auto`}
          >
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="RISK_CHANGES_ONLY">Risk changes only</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Subscribing…" : "Get email updates"}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Emails when this record is republished or a risk flag changes. Reporting updates only, not investment
        advice. Unsubscribe anytime.
      </p>
      <FormError message={state?.error} />
    </form>
  );
}
