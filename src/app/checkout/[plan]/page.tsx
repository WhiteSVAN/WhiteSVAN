import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PropHeader } from "@/components/prop-firm/site-header";
import { StartSteps } from "@/components/prop-firm/start-steps";
import { SiteFooter } from "@/components/site-footer";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { INDIAN_STATES, MAX_ACTIVE_ACCOUNTS } from "@/lib/checkout/billing";
import { requireMember } from "@/lib/auth/dal";
import { checkoutModeFor } from "@/lib/checkout/config";
import { activeAccountCount, lastBilling } from "@/lib/checkout/orders";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { checkout } from "../actions";
import { CheckoutForm } from "./checkout-form";
import { OrderSummary } from "./order-summary";

type Props = { params: Promise<{ plan: string }> };

const STATES: readonly string[] = INDIAN_STATES;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = findEvaluationPlan((await params).plan);
  return { title: plan ? `Checkout: ${plan.label} evaluation | WhiteSVAN` : "Checkout | WhiteSVAN", robots: { index: false } };
}

/**
 * Checkout holds the last two of the three steps to an evaluation (creating the account is the
 * first): choose the size and check out, on one screen. The size in the address is only where it
 * starts. Traders pay through Razorpay once its keys are set, and start free until then; staff
 * make test purchases.
 */
export default async function CheckoutPage({ params }: Props) {
  const plan = findEvaluationPlan((await params).plan);
  if (!plan) notFound();
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/signup?plan=${plan.id}`);
  await requireMember();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  if (!user?.email) redirect(`/login?${new URLSearchParams({ next: `/checkout/${plan.id}` })}`);
  const mode = checkoutModeFor(user.email);
  const active = await activeAccountCount(userId);
  const capped = active >= MAX_ACTIVE_ACCOUNTS;
  const last = !capped ? await lastBilling(userId) : null;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PropHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-14">
        <h1 className="text-4xl font-medium tracking-[-.05em] sm:text-5xl">Checkout</h1>
        {!capped ? (
          <>
            <div className="mt-6 max-w-md"><StartSteps done={1} /></div>
            <CheckoutForm
              action={checkout}
              email={user.email}
              mode={mode}
              initialPlan={plan.id}
              attemptId={randomUUID()}
              defaults={{ name: last?.name ?? user.name ?? "", phone: last?.phone?.slice(-10) ?? "", state: last && STATES.includes(last.state) ? last.state : "", terms: false }}
            />
          </>
        ) : (
          <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.15fr_.85fr] lg:gap-12">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8" aria-label="Checkout details">
              <h2 className="text-xl font-medium tracking-tight">You have {active} active accounts</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Traders can hold up to {MAX_ACTIVE_ACCOUNTS} active demo or funded accounts at a time. Pass or close one to start another evaluation.</p>
              <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Go to my accounts</Link>
            </section>
            <OrderSummary plan={plan} mode={mode} />
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
