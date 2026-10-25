import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PayoutCalculator } from "@/components/prop-firm/payout-calculator";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HELP_TOPICS } from "@/lib/help-center";
import { EVALUATION_PLANS, formatInr, PROGRAMME_RULES as R, PROGRAMME_STEPS } from "@/lib/prop-firm";
import { formatPaise } from "@/lib/trading/money";
import { profitForFullPayout } from "@/lib/trading/payouts";
import { ruleSetFor } from "@/lib/trading/rules";

const FIRST = EVALUATION_PLANS[0];
const LAST = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];

export const metadata: Metadata = {
  title: "Funded accounts and payouts | WhiteSVAN",
  description: `How WhiteSVAN funded accounts and payouts work: keep ${R.contractorSharePercent}% of your profit, request a payout twice a month up to ${formatInr(FIRST.payoutCap)}–${formatInr(LAST.payoutCap)}, and work out a payout for any account size.`,
};

const FACTS: [string, string][] = [
  [`${R.contractorSharePercent}%`, "Profit split"],
  ["2x a month", "Payouts"],
  [`${formatInr(FIRST.payoutCap)}–${formatInr(LAST.payoutCap)}`, "Cap per payout"],
];

const PAYOUT_RULES = [
  `Keep ${R.contractorSharePercent}% of the profit on your funded account. Request one payout in each half of the month (the 1st to the 15th, and the 16th to month end), up to the cap for your account size.`,
  "Profit equal to your max drawdown stays in the account as a buffer, so after a payout your balance is still a full drawdown above your floor. A payout takes the profit it pays out of your balance: your share and the firm's.",
  "Every request is checked against the rules, then paid in rupees to your verified bank account. Tax is deducted at source where it applies.",
];

const PAYOUT_TABLE = EVALUATION_PLANS.map((plan) => {
  const rules = ruleSetFor(plan);
  return { plan, cap: rules.payoutCap, buffer: rules.maxLoss, full: profitForFullPayout(rules) };
});

const FAQ_IDS = ["live-capital", "payout-certainty", "deposits"];
const FAQ = FAQ_IDS.flatMap((id) => HELP_TOPICS.flatMap((topic) => topic.articles).filter((article) => article.id === id));
const rupees = (paise: number) => formatPaise(paise, 0);

export default function FundedPage() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <div className="border-b border-[var(--border)] px-5 pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <p className="terminal-label text-[var(--primary)]">Funded accounts</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-medium leading-[1.04] tracking-[-.055em] sm:text-7xl">Get funded.<br /><span className="text-[var(--primary)]">Get paid twice a month.</span></h1>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">Pass the evaluation and trade a funded account with the same loss limits and no profit target. Keep {R.contractorSharePercent}% of the profit, paid in rupees to your bank.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/checkout" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--primary)] px-7 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start your evaluation <ArrowRight size={16} aria-hidden="true" /></Link>
          <a href="#calculator" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border-strong)] px-6 text-sm hover:bg-[var(--card-raised)]">Work out a payout</a>
        </div>
      </div>

      <dl className="mx-auto grid max-w-5xl grid-cols-3 border-b border-[var(--border)] px-5 py-10 sm:px-8 sm:divide-x sm:divide-[var(--border)]">
        {FACTS.map(([value, label]) => <div key={label} className="px-2 text-center lg:px-6"><dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</dt><dd className="mt-2 text-base font-medium tracking-tight sm:text-3xl">{value}</dd></div>)}
      </dl>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2" aria-labelledby="path-title">
        <div>
          <p className="terminal-label">After you pass</p>
          <h2 id="path-title" className="mt-4 text-3xl font-medium tracking-[-.04em] sm:text-4xl">From pass to payout.</h2>
          <ol className="mt-8 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-5 sm:px-7">
            {PROGRAMME_STEPS.map(({ title, body }, index) => <li key={title} className="flex gap-4 py-6"><span className="pt-1 font-mono text-xs text-[var(--primary)]">0{index + 1}</span><div><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p></div></li>)}
          </ol>
        </div>
        <div id="payout-rules" className="scroll-mt-28">
          <p className="terminal-label">Payout rules</p>
          <h2 className="mt-4 text-3xl font-medium tracking-[-.04em] sm:text-4xl">How payouts work.</h2>
          <ul className="mt-8 space-y-4 text-sm leading-7">
            {PAYOUT_RULES.map((rule) => <li key={rule} className="flex gap-3"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden="true" />{rule}</li>)}
          </ul>
          <Link href="/rules#desk" className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--primary)]">Read the full rules <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--card-deep)] py-16 sm:py-20" aria-labelledby="sizes-title">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <p className="terminal-label">By account size</p>
          <h2 id="sizes-title" className="mt-4 text-3xl font-medium tracking-[-.04em] sm:text-4xl">Payout caps and buffers.</h2>
          <div className="mt-8 overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <caption className="sr-only">Payout cap, buffer and the profit needed for a full payout on each account size</caption>
              <thead className="bg-[var(--card-raised)] text-xs text-[var(--muted)]"><tr>{["Account", "Cap per payout", "Buffer that stays in", "Profit for a full payout"].map((label) => <th key={label} scope="col" className="p-3 font-normal sm:p-4">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {PAYOUT_TABLE.map(({ plan, cap, buffer, full }) => <tr key={plan.id} className="bg-[var(--card)]"><th scope="row" className="p-3 font-medium sm:p-4">{plan.label}</th><td className="p-3 font-mono sm:p-4">{rupees(cap)}</td><td className="p-3 font-mono sm:p-4">{rupees(buffer)}</td><td className="p-3 font-mono sm:p-4">{rupees(full)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-6 text-[var(--muted)]">A full payout needs the buffer plus enough profit above it for your {R.contractorSharePercent}% share to reach the cap.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20"><PayoutCalculator /></div>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]" aria-labelledby="faq-title">
        <div><p className="terminal-label text-[var(--primary)]">FAQ</p><h2 id="faq-title" className="mt-4 text-4xl font-medium leading-tight tracking-[-.04em]">About payouts.</h2><Link href="/help#payouts" className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--primary)]">More in the help center <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{FAQ.map((article) => <details key={article.id} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-sm font-medium [&::-webkit-details-marker]:hidden">{article.question}<span className="text-xl font-light text-[var(--primary)] group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-4 max-w-xl pr-7 text-sm leading-7 text-[var(--muted)]">{article.answer}</p></details>)}</div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
