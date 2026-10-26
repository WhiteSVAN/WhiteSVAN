import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AccountSelector } from "@/components/prop-firm/account-selector";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EVALUATION_PLANS, formatInr, PROGRAMME_RULES as R } from "@/lib/prop-firm";

const FIRST = EVALUATION_PLANS[0];
const LAST = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];

export const metadata: Metadata = {
  title: "Evaluations | WhiteSVAN",
  description: `WhiteSVAN evaluation accounts from ${FIRST.label} to ${LAST.label}: one-time fee from ${formatInr(FIRST.fee)}, ${R.targetPercent}% profit target, end-of-day drawdown and an ${R.contractorSharePercent}% profit split when you're funded.`,
};

const FAQ: [string, string][] = [
  ["When can I start?", "Now. Pick a size and check out on one screen, account included: your demo account opens straight away."],
  ["Is the account balance real money?", `No. Demo and funded accounts are simulated. Your payouts are real: ${R.contractorSharePercent}% of the profit on your funded account, up to the cap for your account size.`],
  ["What happens if I break a rule?", "Your evaluation ends, and the platform shows the rule, the date and your equity at the time. You can start a new evaluation whenever you're ready."],
];

/** Pricing: the three sizes and how to start. The rules themselves are on /rules. */
export default function EvaluationsPage() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <div className="border-b border-[var(--border)] px-5 pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <p className="terminal-label">Evaluations</p>
        <h1 className="mx-auto mt-4 max-w-4xl text-5xl sm:text-7xl">Pass one evaluation.<br /><span className="text-[var(--primary)]">Get funded.</span></h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[var(--muted)]">Hit {R.targetPercent}% on a {FIRST.label}–{LAST.label} account without breaking a loss limit, then keep {R.contractorSharePercent}% of the profit on a funded account.</p>
        <Link href="/checkout" className="prop-button mt-8">Start your evaluation <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <AccountSelector />
      <section className="mx-auto grid max-w-7xl gap-10 border-t border-[var(--border)] px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
        <div><p className="terminal-label">FAQ</p><h2 className="display mt-3 text-4xl leading-tight">Common questions</h2><Link href="/help" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]">Visit the help center <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{FAQ.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex list-none items-center justify-between gap-5 text-base font-medium [&::-webkit-details-marker]:hidden">{question}<span className="text-xl font-light text-[var(--muted)] group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-4 max-w-xl pr-7 text-sm leading-7 text-[var(--muted)]">{answer}</p></details>)}</div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
