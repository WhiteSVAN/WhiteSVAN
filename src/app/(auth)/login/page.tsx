"use client";

import Link from "next/link";
import { useActionState } from "react";
import { authenticate } from "../actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";

export default function LoginPage() {
  const [state, action, pending] = useActionState(authenticate, undefined);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-100">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Return to Quantidive.</p>

      <form action={action} className="mt-6 space-y-4">
        <FormError message={state?.message} />

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
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
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

      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-blue-700 hover:text-blue-800">
          Create an account
        </Link>
      </p>
    </div>
  );
}
