"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "../actions";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-100">Create your operator profile</h1>
      <p className="mt-1 text-sm text-slate-500">Join the professional trader network.</p>

      <form action={action} className="mt-6 space-y-4">
        <FormError message={state?.message} />

        <div>
          <label htmlFor="name" className={labelClass}>
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputClass}
          placeholder="Alex Morgan"
          />
          <FieldError messages={state?.errors?.name} />
        </div>

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
            autoComplete="new-password"
            required
            className={inputClass}
          />
          <FieldError messages={state?.errors?.password} />
          <p className="mt-1 text-xs text-slate-400">
            At least 8 characters, with a letter and a number.
          </p>
        </div>

        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-700 hover:text-blue-800">
          Sign in
        </Link>
      </p>
    </div>
  );
}
