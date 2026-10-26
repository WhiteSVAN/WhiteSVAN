import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, ChartNoAxesCombined, ShieldCheck } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HELP_TOPICS } from "@/lib/help-center";
import { EVALUATION_PLANS, formatInr, PROGRAMME_RULES as R, PROGRAMME_STEPS } from "@/lib/prop-firm";

const FIRST = EVALUATION_PLANS[0];

export const metadata: Metadata = {
  title: "How it works | WhiteSVAN",
  description: `Pass one evaluation on NIFTY, BANK NIFTY and SENSEX options, get a funded account and keep ${R.contractorSharePercent}% of the profit.`,
};

/** Each programme step and the rules that go with it, on /rules. */
const STEP_DETAILS = [
  { icon: ChartNoAxesCombined, link: { href: "/rules#evaluation", label: "The rules to pass" } },
  { icon: ShieldCheck, link: { href: "/rules#limits", label: "The rules for every account" } },
  { icon: BadgeIndianRupee, link: { href: "/rules#desk", label: "The payout rules" } },
];

/** The three steps to an account, all on the checkout screen. */
const START = [
  { title: "Create your account", body: "With Google, or an email and password, right on the checkout screen." },
  { title: "Choose your size", body: `${EVALUATION_PLANS.map((plan) => plan.label).join(", ")}: the same rules, with amounts to match.` },
  { title: "Check out", body: "Your demo account opens on the trading platform straight away." },
];

const FAQ_IDS = ["rule-breach", "real-money", "deposits"];
const FAQ = FAQ_IDS.flatMap((id) => HELP_TOPICS.flatMap((topic) => topic.articles).filter((article) => article.id === id));

export default function HowItWorksPage() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <div className="border-b border-[var(--border)] px-5 pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <p className="terminal-label">How it works</p>
        <h1 className="mx-auto mt-4 max-w-4xl text-5xl sm:text-7xl">Pass. Get funded.<br /><span className="text-[var(--primary)]">Get paid.</span></h1>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/checkout" className="prop-button">Start your evaluation <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/rules" className="prop-button-outline">Read the rules</Link>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="steps-title">
        <h2 id="steps-title" className="sr-only">Three steps to a payout</h2>
        <ol className="grid gap-5 lg:grid-cols-3">
          {PROGRAMME_STEPS.map(({ title, body }, index) => {
            const { icon: Icon, link } = STEP_DETAILS[index];
            return <li key={title} className="terminal-card flex flex-col p-7">
              <div className="flex items-center justify-between"><Icon size={24} strokeWidth={1.5} aria-hidden="true" /><span className="display text-3xl text-[var(--border-strong)]">{index + 1}</span></div>
              <h3 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p>
              <Link href={link.href} className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-medium text-[var(--primary)]">{link.label} <ArrowRight size={15} aria-hidden="true" /></Link>
            </li>;
          })}
        </ol>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--card-deep)] py-16 sm:py-20" aria-labelledby="start-steps-title">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <p className="terminal-label">Starting</p>
          <h2 id="start-steps-title" className="display mt-3 text-3xl sm:text-4xl">One screen, three steps.</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {START.map((step, index) => <li key={step.title} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="font-mono text-sm text-[var(--primary)]">{index + 1}</p>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.body}</p>
            </li>)}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]" aria-labelledby="faq-title">
        <div><p className="terminal-label">FAQ</p><h2 id="faq-title" className="display mt-3 text-4xl leading-tight">Common questions</h2><Link href="/help" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]">Visit the help center <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{FAQ.map((article) => <details key={article.id} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-medium [&::-webkit-details-marker]:hidden">{article.question}<span className="text-xl font-light text-[var(--muted)] group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-4 max-w-xl pr-7 text-sm leading-7 text-[var(--muted)]">{article.answer}</p></details>)}</div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8" aria-labelledby="start-title">
        <div className="terminal-card flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center sm:p-9">
          <div><h2 id="start-title" className="display text-2xl">Evaluations from {formatInr(FIRST.fee)}.</h2><p className="mt-2 text-sm text-[var(--muted)]">One-time fee, GST included. No subscription, no activation fee.</p></div>
          <Link href="/checkout" className="prop-button shrink-0">Start your evaluation <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
