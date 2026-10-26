import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { auth, googleEnabled } from "@/auth";
import { prisma } from "@/lib/db";
import { INDIAN_STATES } from "@/lib/checkout/billing";
import { requireMember } from "@/lib/auth/dal";
import { checkoutModeFor } from "@/lib/checkout/config";
import { razorpayConfig } from "@/lib/checkout/razorpay";
import { lastBilling } from "@/lib/checkout/orders";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { checkout } from "../actions";
import { CheckoutForm } from "./checkout-form";

type Props = { params: Promise<{ plan: string }>; searchParams: Promise<{ ref?: string }> };

const STATES: readonly string[] = INDIAN_STATES;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = findEvaluationPlan((await params).plan);
  return { title: plan ? `Checkout: ${plan.label} evaluation | WhiteSVAN` : "Checkout | WhiteSVAN", robots: { index: false } };
}

/**
 * All three steps to an evaluation on one screen: create the account (signed out), choose the
 * size and check out. The size in the address is only where it starts. Traders pay through
 * Razorpay once its keys are set, and start free until then; staff make test purchases.
 */
export default async function CheckoutPage({ params, searchParams }: Props) {
  const plan = findEvaluationPlan((await params).plan);
  if (!plan) notFound();
  const referral = (await searchParams).ref?.slice(0, 16);
  const userId = (await auth())?.user?.id;
  let user: { email: string } | null = null;
  if (userId) {
    await requireMember();
    const found = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!found?.email) redirect(`/login?${new URLSearchParams({ next: `/checkout/${plan.id}` })}`);
    user = { email: found.email };
  }
  const mode = checkoutModeFor(user?.email);
  const last = userId ? await lastBilling(userId) : null;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PropHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-14">
        <h1 className="text-4xl sm:text-5xl">Start your evaluation</h1>
        <p className="mt-3 text-base text-[var(--muted)]">{user ? "Choose your size and check out." : "Three steps on one screen: your account, your size, and check out."}</p>
        <CheckoutForm
          action={checkout}
          account={user}
          google={googleEnabled}
          referral={referral}
          mode={mode}
          testMode={mode === "razorpay" && razorpayConfig()?.testMode === true}
          initialPlan={plan.id}
          attemptId={randomUUID()}
          defaults={{ email: "", phone: last?.phone?.slice(-10) ?? "", state: last?.state && STATES.includes(last.state) ? last.state : "" }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
