import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeIndianRupee, ChartCandlestick, Check, ChevronDown, IndianRupee, ReceiptIndianRupee, ShieldCheck, Target } from "lucide-react";
import { PropHeader } from "./site-header";
import { AccountSelector } from "./account-selector";
import { SiteFooter } from "@/components/site-footer";
import { EVALUATION_PLANS, formatInr, PROGRAMME_RULES as R, PROGRAMME_STEPS } from "@/lib/prop-firm";

const FIRST = EVALUATION_PLANS[0];
const LAST = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];
const STEP_ICONS = [Target, ShieldCheck, BadgeIndianRupee];

const RULES = [
  [`${R.targetPercent}%`, "Profit target"],
  [`${R.maximumLossPercent}%`, "Max drawdown, end of day"],
  [`${R.dailyLossPercent}%`, "Daily loss limit"],
];

const INDIA = [
  { icon: ChartCandlestick, title: "NIFTY, BANK NIFTY and SENSEX", text: "Index options on NSE and BSE, sized in exchange lots." },
  { icon: IndianRupee, title: "Priced and paid in rupees", text: `One-time fees from ${formatInr(FIRST.fee)}, GST included. Payouts to your Indian bank account.` },
  { icon: ReceiptIndianRupee, title: "Indian costs and hours", text: "Brokerage, STT, exchange charges, the SEBI fee, stamp duty and GST in every fill. Intraday, on IST." },
];

/** Short answers; the rules themselves live on /rules, so rule questions link there. */
const FAQ: { question: string; answer: string; link?: { href: string; label: string } }[] = [
  { question: "How does the evaluation work?", answer: `Trade a demo account until you reach the ${R.targetPercent}% profit target, on at least ${R.minimumDays} trading days, without hitting either loss limit.`, link: { href: "/rules#evaluation", label: "The rules to pass" } },
  { question: "Are the accounts real money?", answer: `No. Demo and funded accounts are simulated. Your payouts are real: ${R.contractorSharePercent}% of the profit on your funded account.` },
  { question: "How often can I get paid?", answer: "Whenever your funded account's profit is above its buffer. There's no payout calendar.", link: { href: "/rules#desk", label: "The payout rules" } },
  { question: "Are there monthly or activation fees?", answer: "No. Every evaluation is a one-time fee with GST included. No subscription and no activation fee when you pass." },
  { question: "What can I trade?", answer: "NIFTY, BANK NIFTY and SENSEX options, intraday: buy a call or a put, and sell to close it.", link: { href: "/rules#markets", label: "Products and hours" } },
  { question: "When can I start?", answer: "Now. Pick a size and check out on one screen, account included: your demo account opens straight away." },
];

export function PropLanding() {
  return <div className="min-h-screen overflow-clip bg-[var(--background)] text-[var(--foreground)]">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-[var(--ink)] focus:px-4 focus:py-3 focus:text-[var(--ink-foreground)]">Skip to content</a>
    <PropHeader />
    <main id="main">
      <section className="prop-hero prop-texture relative border-b border-[var(--border)]">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-28 lg:grid-cols-[1.2fr_.8fr] lg:gap-16">
          <div className="qd-fade-up">
            <p className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-1.5 text-xs font-medium text-[var(--muted)]"><span className="terminal-dot" aria-hidden="true" /> The prop firm for Indian index options</p>
            <h1 className="text-[clamp(3rem,6vw,5.75rem)] leading-[1.02]">Pass. Get funded.<br /><span className="text-[var(--primary)]">Get paid.</span></h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">Trade NIFTY, BANK NIFTY and SENSEX. Pass one evaluation, get a funded account of up to {LAST.label} and keep {R.contractorSharePercent}% of the profit.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/checkout" className="prop-button">Start your evaluation <ArrowUpRight size={17} /></Link><Link href="#how-it-works" className="prop-button-outline">How it works</Link></div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">{["One-time fee", "No activation fee", "End-of-day drawdown"].map((item) => <span key={item} className="flex items-center gap-1.5"><Check size={14} className="text-[var(--primary)]" /> {item}</span>)}</div>
          </div>
          <section aria-labelledby="hero-rules" className="terminal-card p-7 sm:p-9">
            <h2 id="hero-rules" className="terminal-label">The rules at a glance</h2>
            <dl className="mt-4 divide-y divide-[var(--border)]">{RULES.map(([value, label]) => <div key={label} className="flex items-baseline justify-between gap-6 py-5"><dt className="text-sm">{label}</dt><dd className="display text-[2.6rem] leading-none">{value}</dd></div>)}</dl>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Of your starting balance, on every size.</p>
            <Link href="/rules" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]">Read the rules <ArrowRight size={14} aria-hidden="true" /></Link>
          </section>
        </div>
      </section>
      <section aria-label="At a glance" className="border-b border-[var(--border)] bg-[var(--card-deep)]">
        <div className="mx-auto grid max-w-5xl grid-cols-3 px-3 py-7 sm:px-8 sm:divide-x sm:divide-[var(--border)]">
          {[[`${FIRST.label}–${LAST.label}`, "Account sizes"], [`${R.contractorSharePercent}%`, "Profit split"], ["On demand", "Payouts"]].map(([value, label]) => <div key={label} className="px-2 py-3 text-center"><p className="display whitespace-nowrap text-[1.35rem] leading-tight sm:text-[2rem]">{value}</p><p className="mt-2 text-[11px] uppercase tracking-[0.09em] text-[var(--muted)]">{label}</p></div>)}
        </div>
      </section>
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-24">
        <div className="text-center"><p className="terminal-label">How it works</p><h2 className="prop-heading mt-3">Three steps to a payout.</h2><Link href="/how-it-works" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]">See every step <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">{PROGRAMME_STEPS.map(({ title, body }, index) => { const Icon = STEP_ICONS[index]; return <li key={title} className="prop-step terminal-card relative p-7"><div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-deep)]"><Icon size={22} strokeWidth={1.5} aria-hidden="true" /></span><span className="display text-5xl leading-none text-[var(--border-strong)]">{String(index + 1).padStart(2, "0")}</span></div><h3 className="mt-9 text-xl font-semibold tracking-tight">{title}</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p></li>; })}</ol>
      </section>
      <div className="prop-accounts relative border-y border-[var(--border)]"><AccountSelector /></div>
      <section aria-labelledby="india-title" className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
          <p className="terminal-label">Built for India</p><h2 id="india-title" className="prop-heading mt-3">Made for Indian index traders.</h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">{INDIA.map(({ icon: Icon, title, text }) => <article key={title} className="bg-[var(--card)] p-7"><Icon size={24} strokeWidth={1.5} className="text-[var(--primary)]" aria-hidden="true" /><h3 className="mt-6 text-lg font-semibold tracking-tight">{title}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{text}</p></article>)}</div>
        </div>
      </section>
      <section id="faq" className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-24"><div className="mb-10 text-center"><p className="terminal-label">FAQ</p><h2 className="prop-heading mt-3">Questions</h2></div><div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{FAQ.map(({ question, answer, link }) => <details key={question} className="group py-1"><summary className="flex list-none items-center justify-between gap-5 py-6 text-base font-medium [&::-webkit-details-marker]:hidden">{question}<ChevronDown size={17} className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" /></summary><p className="max-w-3xl pb-6 pr-6 text-sm leading-7 text-[var(--muted)]">{answer}{link && <> <Link href={link.href} className="font-medium text-[var(--primary)]">{link.label} →</Link></>}</p></details>)}</div><p className="mt-6 text-center text-sm text-[var(--muted)]">More answers in the <Link href="/help" className="font-medium text-[var(--primary)]">help center</Link>.</p></section>
      <section className="px-5 pb-20 sm:px-8"><div className="prop-final prop-texture relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-[var(--border)] px-6 py-16 text-center sm:py-24"><h2 className="prop-heading relative">Ready to get funded?</h2><p className="relative mx-auto mt-5 max-w-lg text-base leading-7 text-[var(--muted)]">Pick a size and check out on one screen. Then you&apos;re trading.</p><Link href="/checkout" className="prop-button relative mt-8">Start your evaluation <ArrowUpRight size={17} /></Link><p className="relative mx-auto mt-8 max-w-md border-t border-[var(--border)] pt-8 text-sm leading-6 text-[var(--muted)]">One-time fee from {formatInr(FIRST.fee)}, GST included. No subscription and no activation fee.</p></div></section>
    </main>
    <SiteFooter />
  </div>;
}
