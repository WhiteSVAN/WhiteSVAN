"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { btnPrimary, FieldError, inputClass, labelClass } from "@/components/form";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-100">Reset your password</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>

      {state?.sent ? (
        <div
          className="mt-6 rounded-lg border border-emerald-900/60 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200"
          role="status"
        >
          If an account exists for that email, a reset link is on its way. The link expires in one
          hour.
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
              placeholder="you@example.com"
            />
            <FieldError messages={state?.errors?.email} />
          </div>

          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-zinc-200 hover:text-zinc-100">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
