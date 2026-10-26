"use client";

import { useActionState } from "react";
import { signup } from "../actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";

/** Email and password, nothing else. `plan` is a size picked on the storefront; `next` replaces checkout as the destination. */
export function SignupForm({ referral, plan, next }: { referral?: string; plan?: string; next?: string }) {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.message} />
      {referral && <input type="hidden" name="ref" value={referral} />}
      {plan && <input type="hidden" name="plan" value={plan} />}
      {next && <input type="hidden" name="next" value={next} />}

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
        <p className="mt-1.5 text-xs text-[var(--muted)]">At least 8 characters, with a letter and a number.</p>
      </div>

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
