"use client";

import Link from "next/link";
import { useActionState } from "react";
import { authenticate } from "../actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";

/**
 * Sign-in form. `initialMessage` lets the server page surface an auth error that
 * came back via `?error=` (NextAuth can redirect on a failed credentials sign-in
 * instead of returning through the action), and `notice` shows a success banner
 * (e.g. after a password reset).
 */
export function LoginForm({
  initialMessage,
  notice,
}: {
  initialMessage?: string;
  notice?: string;
}) {
  const [state, action, pending] = useActionState(authenticate, undefined);
  const message = state?.message ?? initialMessage;

  return (
    <form action={action} className="mt-6 space-y-4">
      {notice && (
        <div
          className="rounded-lg border border-emerald-900/60 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200"
          role="status"
        >
          {notice}
        </div>
      )}
      <FormError message={message} />

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

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <Link
            href="/forgot"
            className="text-xs font-medium text-zinc-200 hover:text-zinc-100"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
        <FieldError messages={state?.errors?.password} />
      </div>

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
