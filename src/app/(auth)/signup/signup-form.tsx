"use client";

import { useActionState } from "react";
import { signup } from "../actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";
import { RolePicker } from "@/components/auth/role-picker";

export function SignupForm({ initialRole, referral }: { initialRole: "TRADER" | "CLIENT"; referral?: string }) {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state?.message} />
      {referral && <input type="hidden" name="ref" value={referral} />}

      <RolePicker defaultRole={initialRole} />
      <FieldError messages={state?.errors?.role} />

      <div>
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input id="name" name="name" type="text" autoComplete="name" required className={inputClass} placeholder="Alex Morgan" />
        <FieldError messages={state?.errors?.name} />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} placeholder="you@example.com" />
        <FieldError messages={state?.errors?.email} />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className={inputClass} />
        <FieldError messages={state?.errors?.password} />
        <p className="mt-1 text-xs text-zinc-400">At least 8 characters, with a letter and a number.</p>
      </div>

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
