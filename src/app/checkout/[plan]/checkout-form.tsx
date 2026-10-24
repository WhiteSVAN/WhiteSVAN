"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { INDIAN_STATES } from "@/lib/checkout/billing";
import { formatPaise } from "@/lib/trading/money";
import type { CheckoutState } from "../actions";

const field = "mt-1.5 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--card-deep)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--faint)] focus:border-[var(--primary)] focus:outline-none";
const label = "block text-xs font-medium text-[var(--muted)]";

function Errors({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="mt-1.5 text-xs text-[var(--danger)]">{messages[0]}</p> : null;
}

/**
 * Billing details, the agreements and the purchase button: a staff test purchase, or (demo mode)
 * payment from the user's virtual demo credit. `price` and `creditLeft` are in paise.
 */
export function CheckoutForm({ action, email, defaultName, total, mode, price, creditLeft }: { action: (state: CheckoutState | undefined, formData: FormData) => Promise<CheckoutState | undefined>; email: string; defaultName: string; total: string; mode: "test" | "demo"; price: number; creditLeft: number }) {
  const [state, submit, pending] = useActionState(action, undefined);
  const short = mode === "demo" && creditLeft < price;

  return (
    <form action={submit} className="space-y-8" noValidate>
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">1. Your details</legend>
        <p className="text-xs text-[var(--muted)]">Signed in as <span className="text-[var(--foreground)]">{email}</span>. Your receipt and account details go here.</p>
        <label className={label} htmlFor="checkout-name">Full name
          <input id="checkout-name" name="name" defaultValue={defaultName} autoComplete="name" required aria-invalid={Boolean(state?.errors?.name)} className={field} />
          <Errors messages={state?.errors?.name} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label} htmlFor="checkout-phone">Mobile number
            <input id="checkout-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" required aria-invalid={Boolean(state?.errors?.phone)} className={field} />
            <Errors messages={state?.errors?.phone} />
          </label>
          <label className={label} htmlFor="checkout-state">State
            <select id="checkout-state" name="state" defaultValue="" required aria-invalid={Boolean(state?.errors?.state)} className={field}>
              <option value="" disabled>Choose your state</option>
              {INDIAN_STATES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <Errors messages={state?.errors?.state} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">2. Agreements</legend>
        <label className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-4 text-xs leading-6 text-[var(--muted)]" htmlFor="checkout-terms">
          <input id="checkout-terms" name="terms" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]" aria-invalid={Boolean(state?.errors?.terms)} />
          <span>
            I&apos;ve read the <Link href="/rules" target="_blank" className="text-[var(--primary)] underline-offset-4 hover:underline">evaluation rules</Link>. I understand the account is simulated: {mode === "demo" ? "it's a demo evaluation paid with virtual credit" : "the fee pays for the evaluation"}, I won&apos;t trade or deposit real money, and nothing on WhiteSVAN is investment advice.
          </span>
        </label>
        <Errors messages={state?.errors?.terms} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">3. Payment</legend>
        {mode === "test" ? (
          <p className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/5 p-4 text-xs leading-6 text-[var(--warning)]">Test checkout: your sign-in is on the staff list and payments aren&apos;t live yet, so this purchase isn&apos;t charged. It opens a real evaluation account on the current rules.</p>
        ) : (
          <div className="rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/5 p-4 text-xs leading-6" aria-label="Demo credit">
            <dl className="space-y-1 font-mono">
              <div className="flex justify-between gap-4"><dt className="font-sans text-[var(--muted)]">Demo credit</dt><dd>{formatPaise(creditLeft, 2)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="font-sans text-[var(--muted)]">This evaluation</dt><dd>−{formatPaise(price, 2)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-1"><dt className="font-sans text-[var(--muted)]">Left after</dt><dd className={short ? "text-[var(--danger)]" : "text-[var(--primary)]"}>{short ? "Not enough" : formatPaise(creditLeft - price, 2)}</dd></div>
            </dl>
            <p className="mt-3 text-[var(--muted)]">Demo mode: you pay with virtual credit and nobody is charged. Demo accounts trade like any evaluation but don&apos;t lead to a funded account or a payout.</p>
          </div>
        )}
        {short && <p role="alert" className="rounded-lg border border-[var(--danger)]/40 p-4 text-sm text-[var(--danger)]">Not enough demo credit left for this account size. Pick a smaller one.</p>}
        {state?.message && <p role="alert" className="rounded-lg border border-[var(--danger)]/40 p-4 text-sm text-[var(--danger)]">{state.message}</p>}
        <button type="submit" disabled={pending || short} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-60">
          <Lock className="h-4 w-4" aria-hidden="true" /> {pending ? "Opening your account…" : mode === "test" ? `Complete test purchase · ${total}` : `Pay ${total} with demo credit`}
        </button>
      </fieldset>
    </form>
  );
}
