import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeIndianRupee, ChartCandlestick, Check, ChevronDown, IndianRupee, Play, ReceiptIndianRupee, ShieldCheck, Target } from "lucide-react";
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
  { icon: ReceiptIndianRupee, title: "Indian costs and hours", text: "Brokerage, STT, exchange charges, the SEBI fee, stamp duty and GST in every fill. Intraday, 09:15–15:30 IST." },
];

const FAQ = [
  ["How does the evaluation work?", `Hit a ${R.targetPercent}% profit target in at least ${R.minimumDays} trading days without breaching the ${R.dailyLossPercent}% daily loss limit or the ${R.maximumLossPercent}% end-of-day trailing drawdown. When you pass, your best day can be no more than ${R.consistencyPercent}% of your total profit.`],
  ["Are the accounts real money?", `No. Your demo account (the evaluation) and your funded account are simulated. Your payouts are real: you receive ${R.contractorSharePercent}% of the profit you make on your funded account, up to the payout cap for your account size.`],
  ["How often can I get paid?", `Request a payout whenever you have eligible profit and have completed KYC, the funded trader agreement and bank verification. Payouts are capped by account size, from ${formatInr(FIRST.payoutCap)} on a ${FIRST.label} account to ${formatInr(LAST.payoutCap)} on a ${LAST.label} account.`],
  ["Are there monthly or activation fees?", "No. Every evaluation is a one-time fee with GST included. No subscription and no activation fee when you pass."],
  ["What can I trade?", "NIFTY and BANK NIFTY options on NSE, and SENSEX options on BSE. Intraday only, from 09:15 to 15:20 IST. Buy calls or puts, and sell only to close."],
  ["When can I start?", "Now. Create your account, choose a size and check out on one screen: your demo account opens straight away."],
];

export function PropLanding() {
  return <div className="min-h-screen overflow-clip bg-[#0b0f0d] text-[#f0f3ec]">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:bg-[var(--primary)] focus:p-3 focus:text-[var(--primary-foreground)]">Skip to content</a>
    <PropHeader />
    <main id="main">
      <section className="prop-hero relative border-b border-[var(--border)]">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_.8fr] lg:gap-16">
          <div className="qd-fade-up">
            <h1 className="text-[clamp(3.4rem,6.3vw,6.1rem)] font-semibold leading-[1.03] tracking-[-.065em]">Pass. Get funded.<br /><span className="text-[var(--primary)]">Get paid.</span></h1>
            <p className="mt-7 max-w-lg text-[15px] leading-7 text-[#a8b3a4] sm:text-base">Trade NIFTY, BANK NIFTY and SENSEX. Pass one evaluation, get a funded account up to {LAST.label} and keep {R.contractorSharePercent}% of the profit. Request a payout when eligible.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/checkout" className="prop-button">Start your evaluation <ArrowUpRight size={17} /></Link><Link href="#how-it-works" className="prop-button-outline"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#5d7150]"><Play size={9} fill="currentColor" /></span> How it works</Link></div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#9eae93]">{["One-time fee", "No activation fee", "End-of-day drawdown"].map((item) => <span key={item} className="flex items-center gap-1.5"><Check size={13} className="text-[var(--primary)]" /> {item}</span>)}</div>
          </div>
          <section aria-labelledby="hero-rules" className="rounded-2xl border border-[#3b4d32] bg-[#111811] p-7 sm:p-9">
            <h2 id="hero-rules" className="terminal-label">The rules</h2>
            <dl className="mt-6 divide-y divide-[#2a3a24]">{RULES.map(([value, label]) => <div key={label} className="flex items-baseline justify-between gap-6 py-5"><dt className="text-sm text-[#c7d4bf]">{label}</dt><dd className="text-4xl font-medium tracking-[-.05em] text-[var(--primary)]">{value}</dd></div>)}</dl>
            <p className="mt-4 text-xs leading-6 text-[#8b9d7e]">Percentages of your starting balance. Pass in at least {R.minimumDays} trading days, flat by {R.squareOff} IST every day.</p>
            <Link href="/rules" className="mt-5 inline-flex items-center gap-2 text-xs text-[var(--primary)]">All rules <ArrowRight size={14} aria-hidden="true" /></Link>
          </section>
        </div>
      </section>
      <section aria-label="At a glance" className="border-b border-[var(--border)] bg-[#10170f]">
        <div className="mx-auto grid max-w-5xl grid-cols-3 px-5 py-7 sm:px-8 sm:divide-x sm:divide-[#2c3827]">
          {[[`${FIRST.label}–${LAST.label}`, "ACCOUNT SIZES"], [`${R.contractorSharePercent}%`, "PROFIT SPLIT"], ["On demand", "PAYOUTS"]].map(([value, label]) => <div key={label} className="px-2 py-3 text-center"><p className="text-xl font-medium tracking-[-.045em] sm:text-[29px]">{value}</p><p className="mt-2 font-mono text-[8px] tracking-[.12em] text-[#90a183]">{label}</p></div>)}
        </div>
      </section>
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-24">
        <div className="text-center"><p className="terminal-label">How it works</p><h2 className="prop-heading mt-4">Three steps to a payout.</h2><Link href="/how-it-works" className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--primary)]">See every step <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">{PROGRAMME_STEPS.map(({ title, body }, index) => { const Icon = STEP_ICONS[index]; return <li key={title} className="prop-step relative rounded-xl border border-[var(--border)] bg-[#111811] p-7"><div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#486338] bg-[#203317] text-[var(--primary)]"><Icon size={23} strokeWidth={1.5} aria-hidden="true" /></span><span className="font-mono text-[40px] font-medium tracking-tight text-[#2e3b28]">0{index + 1}</span></div><h3 className="mt-9 text-xl font-medium tracking-[-.035em]">{title}</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p></li>; })}</ol>
      </section>
      <div className="prop-accounts relative border-y border-[var(--border)] bg-[#10160f]"><AccountSelector /></div>
      <section aria-labelledby="india-title" className="border-b border-[var(--border)] bg-[#0d130d]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
          <p className="terminal-label">Built for India</p><h2 id="india-title" className="prop-heading mt-4">Made for Indian index traders.</h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">{INDIA.map(({ icon: Icon, title, text }) => <article key={title} className="bg-[#101710] p-7"><Icon size={24} strokeWidth={1.5} className="text-[var(--primary)]" aria-hidden="true" /><h3 className="mt-6 text-lg font-medium tracking-tight">{title}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{text}</p></article>)}</div>
        </div>
      </section>
      <section id="faq" className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-24"><div className="mb-10 text-center"><p className="terminal-label">FAQ</p><h2 className="prop-heading mt-4">Questions</h2></div><div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{FAQ.map(([q, a]) => <details key={q} className="group py-1"><summary className="flex list-none items-center justify-between gap-5 py-6 text-sm font-medium sm:text-base">{q}<ChevronDown size={17} className="shrink-0 text-[#9db687] transition-transform group-open:rotate-180" /></summary><p className="max-w-3xl pb-6 pr-6 text-sm leading-7 text-[var(--muted)]">{a}</p></details>)}</div><p className="mt-6 text-center text-xs text-[var(--muted)]">More answers in the <Link href="/help" className="text-[var(--primary)]">help center</Link>.</p></section>
      <section className="px-5 pb-20 sm:px-8"><div className="prop-final relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#486337] bg-[#192613] px-6 py-16 text-center sm:py-20"><h2 className="prop-heading relative">Ready to get funded?</h2><p className="relative mx-auto mt-5 max-w-lg text-sm leading-7 text-[#aabd9a]">Create your account, choose your account size and check out. Then you&apos;re trading.</p><Link href="/checkout" className="prop-button relative mt-8">Start your evaluation <ArrowUpRight size={17} /></Link><p className="relative mx-auto mt-8 max-w-md border-t border-[#36492b] pt-8 text-xs leading-6 text-[#aabd9a]">One-time fee from {formatInr(FIRST.fee)}, GST included. No subscription and no activation fee.</p></div></section>
    </main>
    <SiteFooter />
  </div>;
}
