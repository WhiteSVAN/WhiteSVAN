import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AccountSelector } from "@/components/prop-firm/account-selector";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DEMO_CHECKOUT, DEMO_START_ANSWER } from "@/lib/checkout/demo";
import { EVALUATION_PLANS, formatInr, PROGRAMME_RULES as R } from "@/lib/prop-firm";

const FIRST = EVALUATION_PLANS[0];
const LAST = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];

export const metadata: Metadata = {
  title: "Evaluations | WhiteSVAN",
  description: `WhiteSVAN evaluation accounts from ${FIRST.label} to ${LAST.label}: one-time fee from ${formatInr(FIRST.fee)}, ${R.targetPercent}% profit target, end-of-day drawdown and an ${R.contractorSharePercent}% profit split when you're funded.`,
};

/** What changes when you pass; the loss limits stay the same. */
const CHANGES: [string, string, string][] = [
  ["Profit target", `${R.targetPercent}%`, "None"],
  ["Profit split", "—", `${R.contractorSharePercent}%`],
  ["Payouts", "—", "Twice a month, up to your cap"],
];

const FAQ: [string, string][] = [
  ["When can I start?", DEMO_CHECKOUT ? DEMO_START_ANSWER : "We're launching soon. Create your account now to get early access when evaluations open."],
  ["Is the account balance real money?", `No. Evaluation and funded accounts are simulated. Your payouts are real: ${R.contractorSharePercent}% of the profit on your funded account, up to the cap for your account size.`],
  ["What happens if I break a rule?", "Your evaluation ends and you get a breach report showing the trade and the rule. Think it was wrong? Appeal within 7 days. You can start a new evaluation whenever you're ready."],
];

export default function EvaluationsPage() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <div className="border-b border-[var(--border)] px-5 pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <p className="terminal-label text-[var(--primary)]">Evaluations</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-medium leading-[1.04] tracking-[-.055em] sm:text-7xl">Pass one evaluation.<br /><span className="text-[var(--primary)]">Get funded.</span></h1>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">Hit {R.targetPercent}% on a {FIRST.label}–{LAST.label} account without breaking a loss limit, then keep {R.contractorSharePercent}% of the profit on a funded account.</p>
        <Link href="/checkout" className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--primary)] px-7 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start your evaluation <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <AccountSelector />
      <section className="mx-auto max-w-5xl border-t border-[var(--border)] px-5 py-20 sm:px-8" aria-labelledby="compare-title">
        <div className="text-center"><p className="terminal-label text-[var(--primary)]">Evaluation vs funded</p><h2 id="compare-title" className="mt-4 text-3xl font-medium tracking-[-.04em] sm:text-4xl">What changes when you pass</h2></div>
        <div className="mt-10 overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full min-w-[480px] border-collapse text-left text-sm"><caption className="sr-only">What changes between the evaluation and the funded account</caption><thead className="bg-[var(--card-raised)]"><tr><th scope="col" className="p-5 text-xs font-normal text-[var(--muted)]">Rule</th><th scope="col" className="p-5 text-sm font-medium text-[var(--primary)]">Evaluation</th><th scope="col" className="p-5 text-sm font-medium text-[var(--primary)]">Funded account</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{CHANGES.map(([rule, evaluation, funded]) => <tr key={rule} className="bg-[var(--card)]"><th scope="row" className="p-5 text-xs font-normal text-[var(--muted)]">{rule}</th><td className="px-5 py-4 text-xs font-medium">{evaluation}</td><td className="px-5 py-4 text-xs font-medium">{funded}</td></tr>)}</tbody></table></div>
        <p className="mt-4 text-center text-xs leading-6 text-[var(--muted)]">The loss limits stay the same: {R.maximumLossPercent}% end-of-day drawdown and a {R.dailyLossPercent}% daily loss limit.</p>
      </section>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
        <div><p className="terminal-label text-[var(--primary)]">FAQ</p><h2 className="mt-4 text-4xl font-medium leading-tight tracking-[-.04em]">Common questions</h2><Link href="/help" className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--primary)]">Visit the help center <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{FAQ.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex list-none items-center justify-between gap-5 text-sm font-medium [&::-webkit-details-marker]:hidden">{question}<span className="text-xl font-light text-[var(--primary)] group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-4 max-w-xl pr-7 text-sm leading-7 text-[var(--muted)]">{answer}</p></details>)}</div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
