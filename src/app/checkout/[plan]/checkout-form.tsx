"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { INDIAN_STATES } from "@/lib/checkout/billing";
import type { CheckoutMode } from "@/lib/checkout/config";
import { TEST_PAYMENT } from "@/lib/checkout/razorpay";
import { EVALUATION_PLANS, findEvaluationPlan, formatInr, RECOMMENDED_PLAN } from "@/lib/prop-firm";
import { confirmPayment, type CheckoutState, type CheckoutValues, type PaymentRequest } from "../actions";
import { OrderSummary } from "./order-summary";

const field = "mt-1.5 min-h-12 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--card-deep)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--faint)] focus:border-[var(--primary)] focus:outline-none";
const label = "block text-xs font-medium text-[var(--muted)]";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckout;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let checkoutScript: Promise<RazorpayConstructor> | null = null;

/** Razorpay Checkout.js, loaded once; a failed load is retried on the next payment. */
function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  checkoutScript ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay didn't load. Try again.")));
    script.onerror = () => reject(new Error("Couldn't reach Razorpay. Check your connection and try again."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    checkoutScript = null;
    throw error;
  });
  return checkoutScript;
}

function Errors({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="mt-1.5 text-xs text-[var(--danger)]">{messages[0]}</p> : null;
}

/**
 * Checkout's two steps, choose the size and pay, beside the order summary. The size changes in
 * place and the address follows it; the details start from the trader's last order. `mode` says
 * how it settles: Razorpay Checkout for the fee, a free start while payments aren't switched on,
 * or a staff test purchase.
 */
export function CheckoutForm({ action, email, defaults, mode, testMode = false, initialPlan, attemptId }: { action: (state: CheckoutState | undefined, formData: FormData) => Promise<CheckoutState | undefined>; email: string; defaults: CheckoutValues; mode: CheckoutMode; testMode?: boolean; initialPlan: string; attemptId: string }) {
  const [state, submit, pending] = useActionState(action, undefined);
  const [confirming, startConfirming] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [planId, setPlanId] = useState(initialPlan);
  const [attempt] = useState(attemptId);
  const opened = useRef<string | null>(null);
  const plan = findEvaluationPlan(planId) ?? RECOMMENDED_PLAN;
  const total = formatInr(plan.fee);
  // A refused checkout comes back with what was sent, so nothing has to be typed twice.
  const values = state?.values ?? defaults;
  const busy = pending || confirming;

  // Start loading Checkout.js with the page, so the payment window opens without a wait.
  useEffect(() => {
    if (mode === "razorpay") loadRazorpay().catch(() => undefined);
  }, [mode]);

  // A new Razorpay order from the server: open the payment window on it, once.
  useEffect(() => {
    const payment: PaymentRequest | undefined = state?.payment;
    if (!payment || opened.current === payment.orderId) return;
    opened.current = payment.orderId;
    loadRazorpay()
      .then((Razorpay) => {
        setNotice(null);
        const checkout = new Razorpay({
          key: payment.keyId,
          amount: payment.amount,
          currency: "INR",
          name: "WhiteSVAN",
          description: payment.description,
          order_id: payment.razorpayOrderId,
          prefill: payment.prefill,
          notes: { order: payment.orderId },
          theme: { color: "#baf277" },
          handler: (response: RazorpaySuccess) => {
            startConfirming(async () => {
              const result = await confirmPayment({ orderId: payment.orderId, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
              if (result?.message) setNotice(result.message);
            });
          },
          modal: { ondismiss: () => setNotice("Payment window closed. Check My accounts for confirmation before trying again.") },
        });
        checkout.on("payment.failed", (response) => setNotice(response.error?.description ? `${response.error.description} Try again, or use another method.` : "The payment didn't go through. Try again, or use another method."));
        checkout.open();
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Couldn't open the payment window. Try again."));
  }, [state]);

  const choose = (id: string) => {
    setPlanId(id);
    window.history.replaceState(null, "", `/checkout/${id}`);
  };

  const button = confirming ? "Confirming your payment…" : pending ? (mode === "razorpay" ? "Opening payment…" : "Opening your account…") : mode === "test" ? `Complete test purchase · ${total}` : mode === "razorpay" ? `Pay ${total}` : "Start evaluation";

  return (
    <div className="mt-8 grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[1.15fr_.85fr] lg:gap-12">
      <section className="min-w-0 space-y-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-8" aria-label="Checkout details">
        {/* Outside the form: the size reaches the server through the hidden field below. */}
        <fieldset disabled={busy} className="min-w-0">
          <legend className="text-sm font-medium">2. Choose your account size</legend>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {EVALUATION_PLANS.map((tier) => {
              const selected = tier.id === plan.id;
              return (
                <label key={tier.id} className={`flex min-w-0 cursor-pointer flex-col rounded-xl border p-3 sm:p-4 ${selected ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border-strong)] hover:border-[var(--primary)]"}`}>
                  <input type="radio" name="checkout-size" value={tier.id} checked={selected} onChange={() => choose(tier.id)} className="h-4 w-4" />
                  <span className="mt-3 text-2xl font-medium tracking-[-.04em]">{tier.label}</span>
                  <span className="mt-1 text-xs text-[var(--muted)]">{formatInr(tier.fee)}</span>
                  <span className="text-xs text-[var(--muted)]">{tier.lots} {tier.lots === 1 ? "lot" : "lots"}</span>
                  {tier.id === RECOMMENDED_PLAN.id && <span className="mt-2 font-mono text-[9px] uppercase text-[var(--primary)]">Recommended</span>}
                </label>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Every size has the same rules. The size sets your profit target, loss limits, position size and payout cap.</p>
        </fieldset>

        <form action={submit} onSubmit={() => setNotice(null)} noValidate>
          <input type="hidden" name="plan" value={plan.id} />
          <input type="hidden" name="attempt" value={attempt} />
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <legend className="text-sm font-medium">3. Check out</legend>
            <p className="text-xs text-[var(--muted)]">{defaults.name ? <><span className="text-[var(--foreground)]">{defaults.name}</span> · </> : null}<span className="break-all">{email}</span>. Your receipt goes here.</p>
            {/* The name comes from the account; only an account without one is asked for it. */}
            {defaults.name ? <input type="hidden" name="name" value={defaults.name} /> : (
              <label className={label} htmlFor="checkout-name">Full name
                <input id="checkout-name" name="name" defaultValue={values.name} autoComplete="name" required aria-invalid={Boolean(state?.errors?.name)} className={field} />
                <Errors messages={state?.errors?.name} />
              </label>
            )}
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
                I&apos;ve read the <Link href="/rules" target="_blank" className="text-[var(--primary)] underline-offset-4 hover:underline">evaluation rules</Link>. I understand the account is simulated: {mode === "free" ? "" : "the fee pays for the evaluation, "}I won&apos;t trade or deposit real money, and nothing on WhiteSVAN is investment advice.
              </span>
            </label>
            <Errors messages={state?.errors?.terms} />

            {mode === "test" ? (
              <p className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/5 p-4 text-xs leading-6 text-[var(--warning)]">Test checkout: your sign-in is on the staff list, so this purchase isn&apos;t charged. It opens a real demo account on the current rules.</p>
            ) : mode === "razorpay" ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-4 text-xs leading-6 text-[var(--muted)]">
                <p>You pay {total} through Razorpay: UPI, cards or netbanking. One-time, GST included. Your demo account opens as soon as the payment goes through.</p>
                {testMode && <p className="mt-2 text-[var(--warning)]">Razorpay test mode: no money moves. Pay with the UPI ID <span className="font-mono">{TEST_PAYMENT.upi}</span>, or the card <span className="whitespace-nowrap font-mono">{TEST_PAYMENT.card}</span> with any future expiry, any CVV and any 4-digit OTP.</p>}
              </div>
            ) : (
              <p className="rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/5 p-4 text-xs leading-6 text-[var(--muted)]">No payment is taken: your demo account opens free of charge, on the same rules as a paid one.</p>
            )}
            {(notice ?? state?.message) && <p role="alert" className="rounded-lg border border-[var(--danger)]/40 p-4 text-sm text-[var(--danger)]">{notice ?? state?.message}</p>}
            <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-60">
              <Lock className="h-4 w-4" aria-hidden="true" /> {button}
            </button>
          </fieldset>
        </form>
      </section>
      <OrderSummary plan={plan} mode={mode} />
    </div>
  );
}
