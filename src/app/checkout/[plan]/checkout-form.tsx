"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { INDIAN_STATES, planAmount } from "@/lib/checkout/billing";
import { EVALUATION_PLANS, findEvaluationPlan, formatInr, RECOMMENDED_PLAN } from "@/lib/prop-firm";
import { formatPaise } from "@/lib/trading/money";
import type { CheckoutState, CheckoutValues } from "../actions";
import { OrderSummary } from "./order-summary";

const field = "mt-1.5 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--card-deep)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--faint)] focus:border-[var(--primary)] focus:outline-none";
const label = "block text-xs font-medium text-[var(--muted)]";

function Errors({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="mt-1.5 text-xs text-[var(--danger)]">{messages[0]}</p> : null;
}

/**
 * Checkout's two steps, choose the size and pay, beside the order summary. The size changes in
 * place and the address follows it; the details start from the trader's last order. Pays as a
 * staff test purchase or, in demo mode, from the user's demo credit (`creditLeft`, in paise).
 */
export function CheckoutForm({ action, email, defaults, mode, creditLeft, initialPlan, attemptId }: { action: (state: CheckoutState | undefined, formData: FormData) => Promise<CheckoutState | undefined>; email: string; defaults: CheckoutValues; mode: "test" | "demo"; creditLeft: number; initialPlan: string; attemptId: string }) {
  const [state, submit, pending] = useActionState(action, undefined);
  const [planId, setPlanId] = useState(initialPlan);
  const [attempt] = useState(attemptId);
  const plan = findEvaluationPlan(planId) ?? RECOMMENDED_PLAN;
  const price = planAmount(plan);
  const total = formatInr(plan.fee);
  const short = mode === "demo" && creditLeft < price;
  // A refused checkout comes back with what was sent, so nothing has to be typed twice.
  const values = state?.values ?? defaults;

  const choose = (id: string) => {
    setPlanId(id);
    window.history.replaceState(null, "", `/checkout/${id}`);
  };

  return (
    <div className="mt-8 grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[1.15fr_.85fr] lg:gap-12">
      <section className="min-w-0 space-y-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-8" aria-label="Checkout details">
        {/* Outside the form: the size reaches the server through the hidden field below. */}
        <fieldset disabled={pending} className="min-w-0">
          <legend className="text-sm font-medium">2. Choose your account size</legend>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EVALUATION_PLANS.map((tier) => {
              const selected = tier.id === plan.id;
              return (
                <label key={tier.id} className={`flex min-w-0 cursor-pointer flex-col rounded-xl border p-3 sm:p-4 ${selected ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border-strong)] hover:border-[var(--primary)]"}`}>
                  <span className="flex h-4 items-center justify-between gap-2">
                    <input type="radio" name="checkout-size" value={tier.id} checked={selected} onChange={() => choose(tier.id)} className="h-4 w-4" />
                    {tier.id === RECOMMENDED_PLAN.id && <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--primary)]">Recommended</span>}
                  </span>
                  <span className="mt-3 text-2xl font-medium tracking-[-.04em]">{tier.label}</span>
                  <span className="mt-1 text-xs text-[var(--muted)]">{formatInr(tier.fee)} · {tier.lots} {tier.lots === 1 ? "lot" : "lots"}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Every size has the same rules. The size sets your profit target, loss limits, position size and payout cap.</p>
        </fieldset>

        <form action={submit} noValidate>
          <input type="hidden" name="plan" value={plan.id} />
          <input type="hidden" name="attempt" value={attempt} />
          <fieldset className="min-w-0 space-y-4">
            <legend className="text-sm font-medium">3. Pay</legend>
            <p className="text-xs text-[var(--muted)]">Signed in as <span className="break-all text-[var(--foreground)]">{email}</span>. Your receipt and account details go here.</p>
            <label className={label} htmlFor="checkout-name">Full name
              <input id="checkout-name" name="name" defaultValue={values.name} autoComplete="name" required aria-invalid={Boolean(state?.errors?.name)} className={field} />
              <Errors messages={state?.errors?.name} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label} htmlFor="checkout-phone">Mobile number
                <input id="checkout-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" defaultValue={values.phone} required aria-invalid={Boolean(state?.errors?.phone)} className={field} />
                <Errors messages={state?.errors?.phone} />
              </label>
              <label className={label} htmlFor="checkout-state">State
                {/* Keyed: React resets the form after each submission, and a mounted select ignores a new defaultValue. */}
                <select key={values.state} id="checkout-state" name="state" defaultValue={values.state} required aria-invalid={Boolean(state?.errors?.state)} className={field}>
                  <option value="" disabled>Choose your state</option>
                  {INDIAN_STATES.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <Errors messages={state?.errors?.state} />
              </label>
            </div>

            <label className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-4 text-xs leading-6 text-[var(--muted)]" htmlFor="checkout-terms">
              <input id="checkout-terms" name="terms" type="checkbox" defaultChecked={values.terms} required className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]" aria-invalid={Boolean(state?.errors?.terms)} />
              <span>
                I&apos;ve read the <Link href="/rules" target="_blank" className="text-[var(--primary)] underline-offset-4 hover:underline">evaluation rules</Link>. I understand the account is simulated: {mode === "demo" ? "it's a demo evaluation paid with virtual credit" : "the fee pays for the evaluation"}, I won&apos;t trade or deposit real money, and nothing on WhiteSVAN is investment advice.
              </span>
            </label>
            <Errors messages={state?.errors?.terms} />

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
      </section>
      <OrderSummary plan={plan} mode={mode} />
    </div>
  );
}
