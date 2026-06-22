"use client";

import { useActionState } from "react";
import { resetPassword } from "../actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={state?.message} />

      <div>
        <label htmlFor="password" className={labelClass}>
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
        <FieldError messages={state?.errors?.password} />
        <p className="mt-1 text-xs text-zinc-500">
          At least 8 characters, with a letter and a number.
        </p>
      </div>

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Updating..." : "Set new password"}
      </button>
    </form>
  );
}
