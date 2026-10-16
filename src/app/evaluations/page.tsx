import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, ClipboardCheck, ShieldCheck } from "lucide-react";
import { AccountSelector } from "@/components/prop-firm/account-selector";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EVALUATION_PLANS, PROGRAMME_RULES as R } from "@/lib/prop-firm";

export const metadata: Metadata = {
  title: "Evaluations | WhiteSVAN",
  description: "Compare WhiteSVAN evaluation accounts from ₹1L to ₹10L: one-time fee, 6% profit target, end-of-day drawdown and an 80% profit split when you're funded.",
};

const FIRST = EVALUATION_PLANS[0];
const LAST = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];

const COMPARISON: [string, string, string][] = [
  ["Profit target", `${R.targetPercent}%`, "No target"],
  ["Max drawdown", `${R.maximumLossPercent}%, end-of-day trailing`, `${R.maximumLossPercent}%, end-of-day trailing`],
  ["Daily loss limit", `${R.dailyLossPercent}%`, `${R.dailyLossPercent}%`],
  ["Min trading days", String(R.minimumDays), "—"],
  ["Profit split", "—", `${R.contractorSharePercent}%`],
  ["Payouts", "—", "Twice a month, up to your cap"],
  ["Cost", "One-time fee, GST included", "No activation fee"],
];

const FAQ: [string, string][] = [
  ["When can I start?", "We're launching soon. Create your account now to get early access when evaluations open."],
  ["Is the account balance real money?", `No. Evaluation and funded accounts are simulated. Your payouts are real: ${R.contractorSharePercent}% of the profit on your funded account, up to the cap for your account size.`],
  ["Is there a monthly fee?", "No. Each evaluation is a one-time fee with GST included. No subscription and no activation fee when you pass."],
  ["What happens if I break a rule?", "Your evaluation ends and you get a breach report showing the trade and the rule. Think it was wrong? Appeal within 7 days. You can start a new evaluation whenever you're ready."],
];

export default function EvaluationsPage() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <div className="border-b border-[var(--border)] bg-[radial-gradient(ellipse_at_50%_0%,rgba(186,242,119,.09),transparent_70%)] px-5 pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <p className="terminal-label text-[var(--primary)]">Evaluations</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-medium leading-[1.04] tracking-[-.055em] sm:text-7xl">Pass one evaluation.<br /><span className="text-[var(--primary)]">Get funded.</span></h1>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">A one-step evaluation on a {FIRST.label}–{LAST.label} account. Hit {R.targetPercent}%, stay inside your drawdown and get a funded account with an {R.contractorSharePercent}% profit split.</p>
        <a href="#accounts" className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--primary)] px-7 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Choose your account <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <AccountSelector />
      <section className="border-y border-[var(--border)] bg-[var(--card-deep)] py-16 sm:py-20" aria-labelledby="evaluation-path-title">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="terminal-label">How it works</p><h2 id="evaluation-path-title" className="mt-4 text-3xl font-medium tracking-[-.04em] sm:text-4xl">Three steps to a funded account.</h2></div><Link href="/rules" className="flex items-center gap-2 text-sm text-[var(--primary)]">See all rules <ArrowRight size={15} aria-hidden="true" /></Link></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{[
            { icon: ClipboardCheck, number: "01", title: "Choose your account", body: `Pick ${FIRST.label} to ${LAST.label}. One-time fee with GST included. No subscription, no activation fee.` },
            { icon: ChartNoAxesCombined, number: "02", title: "Pass the evaluation", body: `Hit the ${R.targetPercent}% profit target in at least ${R.minimumDays} trading days without breaking the ${R.dailyLossPercent}% daily loss limit or the ${R.maximumLossPercent}% end-of-day drawdown.` },
            { icon: ShieldCheck, number: "03", title: "Get funded", body: `Complete KYC, sign your funded trader agreement and request payouts twice a month at an ${R.contractorSharePercent}% profit split.` },
          ].map(({ icon: Icon, number, title, body }) => <article key={number} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-7"><div className="flex items-center justify-between"><Icon size={24} className="text-[var(--primary)]" aria-hidden="true" /><span className="font-mono text-sm text-[var(--faint)]">{number}</span></div><h3 className="mt-8 text-xl font-medium">{title}</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p></article>)}</div>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8" aria-labelledby="compare-title">
        <div className="text-center"><p className="terminal-label text-[var(--primary)]">Evaluation vs funded</p><h2 id="compare-title" className="mt-4 text-3xl font-medium tracking-[-.04em] sm:text-4xl">What changes when you pass</h2></div>
        <div className="mt-10 overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><caption className="sr-only">Rules for the evaluation and the funded account</caption><thead className="bg-[var(--card-raised)]"><tr><th scope="col" className="p-5 text-xs font-normal text-[var(--muted)]">Rule</th><th scope="col" className="p-5 text-sm font-medium text-[var(--primary)]">Evaluation</th><th scope="col" className="p-5 text-sm font-medium text-[var(--primary)]">Funded account</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{COMPARISON.map(([rule, evaluation, funded]) => <tr key={rule} className="bg-[var(--card)]"><th scope="row" className="p-5 text-xs font-normal text-[var(--muted)]">{rule}</th><td className="px-5 py-4 text-xs font-medium">{evaluation}</td><td className="px-5 py-4 text-xs font-medium">{funded}</td></tr>)}</tbody></table></div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
        <div><p className="terminal-label text-[var(--primary)]">FAQ</p><h2 className="mt-4 text-4xl font-medium leading-tight tracking-[-.04em]">Questions before<br /><span className="text-[var(--muted)]">you start?</span></h2><p className="mt-5 max-w-sm text-sm leading-7 text-[var(--muted)]">Short answers here, and the full detail in the help center.</p><Link href="/help" className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--primary)]">Visit the help center <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{FAQ.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex list-none items-center justify-between gap-5 text-sm font-medium [&::-webkit-details-marker]:hidden">{question}<span className="text-xl font-light text-[var(--primary)] group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-4 max-w-xl pr-7 text-sm leading-7 text-[var(--muted)]">{answer}</p></details>)}</div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
