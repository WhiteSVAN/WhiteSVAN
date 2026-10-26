"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { INDIAN_STATES } from "@/lib/checkout/billing";
import type { CheckoutMode } from "@/lib/checkout/config";
import { TEST_PAYMENT } from "@/lib/checkout/razorpay";
import { EVALUATION_PLANS, findEvaluationPlan, formatInr, RECOMMENDED_PLAN } from "@/lib/prop-firm";
import { confirmPayment, type CheckoutState, type CheckoutValues, type PaymentRequest } from "../actions";
import { OrderSummary } from "./order-summary";

const field = "mt-1.5 min-h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input)] px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--faint)] focus:outline-none";
const label = "block text-sm font-medium";
const legend = "text-base font-semibold";

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

/** The theme's accent, for Razorpay's payment window. */
function accentColour(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#1f6f3b";
}

function Errors({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="mt-1.5 text-xs text-[var(--danger)]">{messages[0]}</p> : null;
}

/**
 * The three steps on one screen, beside the order summary. Signed out, step 1 creates the account
 * (or signs in to one) in the same submission as the purchase. The size changes in place and the
 * address follows it. A paid checkout asks for a mobile number and state, filled in from the last
 * order; a free start or a test purchase asks for nothing. Pressing the button accepts the rules.
 */
export function CheckoutForm({ action, account, google, referral, defaults, mode, testMode = false, initialPlan, attemptId }: { action: (state: CheckoutState | undefined, formData: FormData) => Promise<CheckoutState | undefined>; account: { email: string } | null; google: boolean; referral?: string; defaults: CheckoutValues; mode: CheckoutMode; testMode?: boolean; initialPlan: string; attemptId: string }) {
  const [state, submit, pending] = useActionState(action, undefined);
  const [confirming, startConfirming] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [planId, setPlanId] = useState(initialPlan);
  const [attempt, setAttempt] = useState(attemptId);
  const opened = useRef<string | null>(null);
  const plan = findEvaluationPlan(planId) ?? RECOMMENDED_PLAN;
  const total = formatInr(plan.fee);
  const values = state?.values ?? defaults;
  const signedIn = account ?? state?.account ?? null;
  const paid = mode === "razorpay";
  const busy = pending || confirming || paying;

  // Start loading Checkout.js with the page, so the payment window opens without a wait.
  useEffect(() => {
    if (mode === "razorpay") loadRazorpay().catch(() => undefined);
  }, [mode]);

  // A new Razorpay order from the server: open the payment window on it, once.
  useEffect(() => {
    const payment: PaymentRequest | undefined = state?.payment;
    if (!payment || opened.current === payment.orderId) return;
    opened.current = payment.orderId;
    setPaying(true);
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
          theme: { color: accentColour() },
          handler: (response: RazorpaySuccess) => {
            startConfirming(async () => {
              setPaying(false);
              opened.current = null;
              const result = await confirmPayment({ orderId: payment.orderId, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
              if (result?.message) setNotice(result.message);
            });
          },
          modal: { ondismiss: () => {
            setPaying(false);
            opened.current = null;
            setNotice("Payment window closed. Check My accounts for confirmation before retrying this checkout.");
          } },
        });
        checkout.on("payment.failed", (response) => setNotice(response.error?.description ? `${response.error.description} Try again, or use another method.` : "The payment didn't go through. Try again, or use another method."));
        checkout.open();
      })
      .catch((error: unknown) => {
        setPaying(false);
        opened.current = null;
        setNotice(error instanceof Error ? error.message : "Couldn't open the payment window. Try again.");
      });
  }, [state]);

  const choose = (id: string) => {
    // Changing the intended purchase after starting payment is a new attempt.
    // Validation failures and retries of the same size keep their original key.
    if (state?.payment && id !== planId) setAttempt(crypto.randomUUID());
    setPlanId(id);
    window.history.replaceState(null, "", `/checkout/${id}${referral ? `?${new URLSearchParams({ ref: referral })}` : ""}`);
  };

  const button = confirming ? "Confirming your payment…" : paying ? "Payment window open…" : pending ? (paid ? "Opening payment…" : "Opening your account…") : mode === "test" ? `Complete test purchase · ${total}` : paid ? `Pay ${total}` : "Start evaluation";
  const consent = `${signedIn ? "" : "you create your account and "}agree to the evaluation rules`;

  return (
    <div className="mt-8 grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[1.15fr_.85fr] lg:gap-12">
      <section className="terminal-card min-w-0 space-y-9 p-5 sm:p-8" aria-label="Checkout details">
        {/* Outside the form, like the size: the fields join it through their form attribute. */}
        <fieldset disabled={busy} className="min-w-0">
          <legend className={legend}>1. Your account</legend>
          {signedIn ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Signed in as <span className="break-all font-medium text-[var(--foreground)]">{signedIn.email}</span>. Your receipt goes here.</p>
          ) : (
            <>
              {google && (
                <div className="mt-4">
                  <GoogleButton role="TRADER" referral={referral} next={`/checkout/${plan.id}`} />
                  <AuthDivider />
                </div>
              )}
              {/* Uncontrolled, so whatever is typed before the page hydrates stays. A refused
                  checkout comes back with the email; the password is never sent back. */}
              <div className={`grid gap-4 sm:grid-cols-2 ${google ? "" : "mt-4"}`}>
                <label className={label} htmlFor="checkout-email">Email
                  <input id="checkout-email" form="checkout-form" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" defaultValue={values.email} required aria-invalid={Boolean(state?.errors?.email)} className={field} />
                  <Errors messages={state?.errors?.email} />
                </label>
                <label className={label} htmlFor="checkout-password">Password
                  <input id="checkout-password" form="checkout-form" name="password" type="password" autoComplete="new-password" required aria-invalid={Boolean(state?.errors?.password)} className={field} />
                  <Errors messages={state?.errors?.password} />
                </label>
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">New here? This creates your account: at least 8 characters, with a letter and a number. Already have one? Use its email and password, or <Link href={`/login?${new URLSearchParams({ next: `/checkout/${plan.id}` })}`} className="font-medium text-[var(--foreground)] underline-offset-4 hover:underline">log in</Link>.</p>
            </>
          )}
        </fieldset>

        {/* Outside the form: the size reaches the server through the hidden field below. */}
        <fieldset disabled={busy} className="min-w-0">
          <legend className={legend}>2. Your account size</legend>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {EVALUATION_PLANS.map((tier) => {
              const selected = tier.id === plan.id;
              return (
                <label key={tier.id} className={`flex min-w-0 cursor-pointer flex-col rounded-xl border p-3 sm:p-4 ${selected ? "border-[var(--foreground)] bg-[var(--card-raised)]" : "border-[var(--border-strong)] hover:border-[var(--foreground)]"}`}>
                  <input type="radio" name="checkout-size" value={tier.id} checked={selected} onChange={() => choose(tier.id)} className="h-4 w-4" />
                  <span className="display mt-3 text-2xl">{tier.label}</span>
                  <span className="mt-1 text-xs text-[var(--muted)]">{formatInr(tier.fee)}</span>
                  <span className="text-xs text-[var(--muted)]">{tier.lots} {tier.lots === 1 ? "lot" : "lots"}</span>
                  {tier.id === RECOMMENDED_PLAN.id && <span className="mt-2 text-[11px] font-medium text-[var(--primary)]">Recommended</span>}
                </label>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Every size has the same rules; the size sets the amounts.</p>
        </fieldset>

        <form id="checkout-form" action={submit} onSubmit={() => setNotice(null)} noValidate>
          <input type="hidden" name="plan" value={plan.id} />
          <input type="hidden" name="attempt" value={attempt} />
          {referral && <input type="hidden" name="ref" value={referral} />}
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <legend className={legend}>3. Check out</legend>
            {paid && (
              <div className="grid gap-4 pt-1 sm:grid-cols-2">
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
            )}

            {mode === "test" ? (
              <p className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/5 p-4 text-xs leading-6 text-[var(--warning)]">Test checkout: your sign-in is on the staff list, so this purchase isn&apos;t charged. It opens a real demo account on the current rules.</p>
            ) : paid ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-4 text-xs leading-6 text-[var(--muted)]">
                <p>You pay {total} through Razorpay: UPI, cards or netbanking. One-time, GST included. Your demo account opens as soon as the payment goes through.</p>
                {testMode && <p className="mt-2 text-[var(--warning)]">Razorpay test mode: no money moves. Pay with the UPI ID <span className="font-mono">{TEST_PAYMENT.upi}</span>, or the card <span className="whitespace-nowrap font-mono">{TEST_PAYMENT.card}</span> with any future expiry, any CVV and any 4-digit OTP.</p>}
              </div>
            ) : (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-4 text-xs leading-6 text-[var(--muted)]">No payment is taken: your demo account opens free of charge, on the same rules as a paid one.</p>
            )}
            {(notice ?? state?.message) && <p role="alert" className="rounded-xl border border-[var(--danger)]/40 p-4 text-sm text-[var(--danger)]">{notice ?? state?.message}</p>}
            <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-sm font-medium text-[var(--ink-foreground)] hover:bg-[var(--ink-hover)] disabled:opacity-60">
              <Lock className="h-4 w-4" aria-hidden="true" /> {button}
            </button>
            <p className="text-xs leading-5 text-[var(--muted)]">
              By {paid ? "paying" : "starting"}, {consent} (<Link href="/rules" target="_blank" className="font-medium text-[var(--foreground)] underline-offset-4 hover:underline">read them</Link>). The account is simulated: {mode === "free" ? "" : "the fee pays for the evaluation, "}you won&apos;t trade or deposit real money, and nothing on WhiteSVAN is investment advice.
            </p>
          </fieldset>
        </form>
      </section>
      <OrderSummary plan={plan} mode={mode} />
    </div>
  );
}
