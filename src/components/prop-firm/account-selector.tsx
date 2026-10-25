"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, CircleHelp, Layers3, Target } from "lucide-react";
import { DEMO_CHECKOUT, DEMO_CREDIT } from "@/lib/checkout/demo";
import { EVALUATION_PLANS, formatInr, planLimits, PROGRAMME_RULES, RECOMMENDED_PLAN } from "@/lib/prop-firm";

/** Pricing: the three account sizes, as an evaluation (fee and limits) or funded (split and payouts). */
export function AccountSelector() {
  const [stage, setStage] = useState<"evaluation" | "funded">("evaluation");
  const isEvaluation = stage === "evaluation";

  return (
    <section id="accounts" className="scroll-mt-28 py-20 sm:py-28" aria-labelledby="accounts-title">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="terminal-label text-[var(--primary)]">Pricing</p>
          <h2 id="accounts-title" className="mt-4 text-4xl font-medium leading-[1.08] tracking-[-0.045em] sm:text-5xl">Choose your account.</h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--muted)]">Three sizes. One-time fee, no subscription, no activation fee.</p>
        </div>

        <div className="mt-9 flex justify-center">
          <div className="inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--card)] p-1" role="group" aria-label="Account stage">
            <button type="button" aria-pressed={isEvaluation} onClick={() => setStage("evaluation")} className={`flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium sm:px-7 ${isEvaluation ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}><Target size={15} aria-hidden="true" /> Evaluation</button>
            <button type="button" aria-pressed={!isEvaluation} onClick={() => setStage("funded")} className={`flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium sm:px-7 ${!isEvaluation ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}><Layers3 size={15} aria-hidden="true" /> Funded</button>
          </div>
        </div>

        <p className="mt-5 min-h-10 text-center text-xs leading-6 text-[var(--muted)]" aria-live="polite">{isEvaluation ? `One-time fee · GST included · Pass in as few as ${PROGRAMME_RULES.minimumDays} trading days` : `After you pass and complete KYC · ${PROGRAMME_RULES.contractorSharePercent}% profit split · Payouts twice a month`}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {EVALUATION_PLANS.map((plan) => {
            const limits = planLimits(plan);
            const recommended = plan.id === RECOMMENDED_PLAN.id;
            return <article key={plan.id} className={`relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--card)] ${recommended ? "border-[var(--primary)] shadow-[0_0_50px_-25px_rgba(186,242,119,.35)]" : "border-[var(--border)]"}`}>
              <div className={`h-1 ${recommended ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
              <div className="px-6 pb-6 pt-6">
                <div className="flex h-6 items-center justify-between gap-2"><p className="font-mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">{isEvaluation ? "Evaluation" : "Funded account"}</p>{recommended && <span className="rounded border border-[var(--primary)] px-2 py-0.5 font-mono text-[9px] uppercase text-[var(--primary)]">Recommended</span>}</div>
                <h3 className="mt-4 text-[2.8rem] font-medium leading-none tracking-[-.065em]">{plan.label}</h3>
                <p className="mt-2 text-xs text-[var(--muted)]">Account size</p>
                <div className="mt-7 flex items-baseline gap-1.5"><span className="text-3xl font-medium tracking-[-.04em]">{isEvaluation ? formatInr(plan.fee) : `${PROGRAMME_RULES.contractorSharePercent}%`}</span><span className="text-xs text-[var(--muted)]">{isEvaluation ? "one-time" : "profit split"}</span></div>
                <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">{isEvaluation ? "GST included" : `Up to ${formatInr(plan.payoutCap)} per payout`}</p>
                <Link href={isEvaluation ? `/checkout/${plan.id}` : "/funded"} className={`mt-6 flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ${recommended ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]" : "border border-[var(--border-strong)] bg-[var(--card-raised)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}>{isEvaluation ? "Start evaluation" : "See how payouts work"}<ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
              <dl className="mx-6 border-t border-[var(--border)] py-2 text-xs">
                {isEvaluation ? <>
                  <Rule label="Profit target" value={formatInr(limits.profitTarget)} />
                  <Rule label="Max drawdown" value={`${formatInr(limits.maximumLoss)} EOD`} />
                  <Rule label="Max position" value={`${plan.lots} ${plan.lots === 1 ? "lot" : "lots"}`} />
                </> : <>
                  <Rule label="Profit split" value={`${PROGRAMME_RULES.contractorSharePercent}%`} />
                  <Rule label="Payout cap" value={formatInr(plan.payoutCap)} />
                  <Rule label="Payouts" value="Twice a month" />
                </>}
              </dl>
              <div className="mt-auto border-t border-[var(--border)] bg-[var(--card-deep)] px-6 py-4"><p className="flex items-center gap-2 text-[11px] text-[var(--muted)]"><Check size={13} className="text-[var(--primary)]" aria-hidden="true" /> NIFTY · BANK NIFTY · SENSEX</p></div>
            </article>;
          })}
        </div>

        <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-xl border border-[var(--border)] px-5 py-4 sm:flex-row">
          <p className="text-xs leading-6 text-[var(--muted)]">{DEMO_CHECKOUT ? `Demo open: pay with ${formatInr(DEMO_CREDIT)} of virtual credit. Nobody is charged.` : "Launching soon. Rules and prices can change before launch."}</p>
          <Link href="/rules" className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-[var(--primary)]"><CircleHelp size={14} aria-hidden="true" /> Read the full rules <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3.5 last:border-0"><dt className="text-[var(--muted)]">{label}</dt><dd className="text-right font-medium">{value}</dd></div>;
}
