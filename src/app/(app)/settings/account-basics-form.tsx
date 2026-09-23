"use client";

import { useActionState } from "react";
import { saveAccountBasics } from "./actions";
import { btnPrimary, FormError, inputClass, labelClass } from "@/components/form";

/** Name (editable) + sign-in email and role (read-only). */
export function AccountBasicsForm({
  name,
  email,
  roleLabel,
  memberSince,
}: {
  name: string;
  email: string | null;
  roleLabel: string;
  memberSince: string;
}) {
  const [state, action, pending] = useActionState(saveAccountBasics, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="userName" className={labelClass}>
            Your name
          </label>
          <input
            id="userName"
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={name}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">Shown to traders on follows and requests.</p>
        </div>
        <div>
          <p className={labelClass}>Sign-in email</p>
          <p className="mt-2 flex min-h-11 items-center truncate rounded-md border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-400">
            {email ?? "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Private. Never shown on public pages.</p>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Account type: <span className="text-zinc-300">{roleLabel}</span> · member since {memberSince}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} sm:w-auto sm:px-6`}>
          {pending ? "Saving..." : "Save account"}
        </button>
        {state?.saved && (
          <span className="text-sm text-zinc-100" role="status">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
