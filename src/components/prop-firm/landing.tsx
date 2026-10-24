import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, BadgeIndianRupee, BookOpen, ChartCandlestick, Check, ChevronDown, Clock3, Flag, Gauge, Headphones, IndianRupee, Landmark, Layers3, Play, ReceiptIndianRupee, ShieldCheck, Target } from "lucide-react";
import { PropHeader } from "./site-header";
import { AccountSelector } from "./account-selector";
import { AccountPreview } from "./account-preview";
import { SiteFooter } from "@/components/site-footer";
import { WaitlistForm } from "@/app/waitlist-form";
import { DEMO_CHECKOUT, DEMO_CREDIT, DEMO_START_ANSWER } from "@/lib/checkout/demo";
import { EVALUATION_PLANS, formatInr, planLimits, PROGRAMME_RULES as R } from "@/lib/prop-firm";

const FEATURED = EVALUATION_PLANS[1];
const FEATURED_LIMITS = planLimits(FEATURED);

const STEPS = [
  { icon: Layers3, n: "01", title: "Start your evaluation.", text: `Create your account, choose ${EVALUATION_PLANS[0].label} to ${EVALUATION_PLANS[EVALUATION_PLANS.length - 1].label} and pay one fee. No subscription, no activation fee.` },
  { icon: Target, n: "02", title: "Pass the evaluation.", text: `Hit the ${R.targetPercent}% profit target in at least ${R.minimumDays} trading days without hitting the drawdown or the daily loss limit.` },
  { icon: Flag, n: "03", title: "Get funded. Get paid.", text: `Complete KYC, sign your funded trader agreement and request payouts twice a month at an ${R.contractorSharePercent}% profit split.` },
];

const INDIA_FEATURES = [
  { icon: IndianRupee, title: "Priced in rupees", text: `One-time fees from ${formatInr(EVALUATION_PLANS[0].fee)}, GST included. No dollar conversions.` },
  { icon: Landmark, title: "Paid to your bank", text: "Payouts in rupees, straight to your Indian bank account." },
  { icon: ChartCandlestick, title: "NSE and BSE contracts", text: "NIFTY, BANK NIFTY and SENSEX futures and options, sized in exchange lots." },
  { icon: ReceiptIndianRupee, title: "Real Indian costs", text: "Brokerage, STT, exchange charges, the SEBI fee, stamp duty and GST in every fill." },
  { icon: Clock3, title: "Indian market hours", text: "09:15–15:30 IST, intraday only, with expiry-day rules built in." },
  { icon: BadgeCheck, title: "KYC with DigiLocker", text: "Verify with PAN and Aadhaar through DigiLocker after you pass." },
];

const FAQ = [
  ["What is WhiteSVAN?", `WhiteSVAN is a prop trading firm for Indian index futures and options. Pass our evaluation to get a funded account and earn an ${R.contractorSharePercent}% profit split trading NIFTY, BANK NIFTY and SENSEX.`],
  ["How does the evaluation work?", `Hit a ${R.targetPercent}% profit target in at least ${R.minimumDays} trading days without breaching the ${R.dailyLossPercent}% daily loss limit or the ${R.maximumLossPercent}% end-of-day trailing drawdown. When you pass, your best day can be no more than ${R.consistencyPercent}% of your total profit.`],
  ["Are the accounts real money?", `No. Evaluation and funded accounts are simulated. Your payouts are real: you receive ${R.contractorSharePercent}% of the profit you make on your funded account, up to the payout cap for your account size.`],
  ["How often can I get paid?", `Funded traders can request a payout twice a month once KYC is done. Payouts are capped by account size, from ${formatInr(EVALUATION_PLANS[0].payoutCap)} on a ${EVALUATION_PLANS[0].label} account to ${formatInr(EVALUATION_PLANS[EVALUATION_PLANS.length - 1].payoutCap)} on a ${EVALUATION_PLANS[EVALUATION_PLANS.length - 1].label} account.`],
  ["Are there monthly or activation fees?", "No. Every evaluation is a one-time fee with GST included. No subscription and no activation fee when you pass."],
  ["What can I trade?", "NIFTY and BANK NIFTY futures and options on NSE, and SENSEX futures and options on BSE. Intraday only, from 09:15 to 15:20 IST."],
  ["When can I buy an evaluation?", DEMO_CHECKOUT ? DEMO_START_ANSWER : "We're launching soon. Create your account now to get early access when evaluations open."],
  ["Where is my trading journal?", "Log in and open Tools. Your journal, imports and performance reports are all still there."],
];

export function PropLanding() {
  return <div className="min-h-screen overflow-clip bg-[#0b0f0d] text-[#f0f3ec]">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:bg-[var(--primary)] focus:p-3 focus:text-[var(--primary-foreground)]">Skip to content</a>
    <PropHeader />
    <main id="main">
      <section className="prop-hero relative border-b border-[var(--border)]">
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.02fr] lg:gap-16 lg:py-16">
          <div className="qd-fade-up">
            <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#3b4d32] bg-[#172113] px-3.5 py-2 text-[10px] font-medium text-[#bddda1]"><span className="terminal-dot" /> Built for Indian index traders <ArrowUpRight size={12} /></p>
            <h1 className="text-[clamp(3.7rem,6.3vw,6.1rem)] font-semibold leading-[1.03] tracking-[-.065em]">Pass. Get funded.<br /><span className="text-[var(--primary)]">Get paid.</span></h1>
            <p className="mt-7 max-w-lg text-[15px] leading-7 text-[#a8b3a4] sm:text-base">Trade NIFTY, BANK NIFTY and SENSEX. Pass one evaluation, get a funded account up to {EVALUATION_PLANS[EVALUATION_PLANS.length - 1].label} and take an {R.contractorSharePercent}% profit split, paid twice a month.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/checkout" className="prop-button">Start your evaluation <ArrowUpRight size={17} /></Link><Link href="#how-it-works" className="prop-button-outline"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#5d7150]"><Play size={9} fill="currentColor" /></span> How it works</Link></div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-[#9eae93]"><span className="flex items-center gap-1.5"><Check size={13} className="text-[var(--primary)]" /> One-time fee</span><span className="flex items-center gap-1.5"><Check size={13} className="text-[var(--primary)]" /> No activation fee</span><span className="flex items-center gap-1.5"><Check size={13} className="text-[var(--primary)]" /> End-of-day drawdown</span></div>
            <p className="mt-6 max-w-md text-[10px] leading-5 text-[#75856f]">{DEMO_CHECKOUT ? <>Demo open. <Link href="/signup" className="text-[#bddda1] underline-offset-4 hover:underline">Create your account</Link> and start an evaluation with {formatInr(DEMO_CREDIT)} of virtual credit.</> : <>Launching soon. <Link href="/signup" className="text-[#bddda1] underline-offset-4 hover:underline">Create your account</Link> for early access.</>}</p>
          </div>
          <AccountPreview />
        </div>
      </section>
      <section aria-label="At a glance" className="border-b border-[var(--border)] bg-[#10170f]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-4 px-5 py-7 sm:px-8 lg:grid-cols-4 lg:divide-x lg:divide-[#2c3827]">
          {[[`${EVALUATION_PLANS[0].label}–${EVALUATION_PLANS[EVALUATION_PLANS.length - 1].label}`, "ACCOUNT SIZES"], [`${R.contractorSharePercent}%`, "PROFIT SPLIT"], [`${R.targetPercent}%`, "PROFIT TARGET"], ["2x a month", "PAYOUTS"]].map(([value, label]) => <div key={label} className="px-4 py-3 text-center"><p className="text-[25px] font-medium tracking-[-.045em] sm:text-[29px]">{value}</p><p className="mt-2 font-mono text-[8px] tracking-[.12em] text-[#90a183]">{label}</p></div>)}
        </div>
      </section>
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-20 sm:px-8 sm:py-24">
        <div className="text-center"><p className="terminal-label">How it works</p><h2 className="prop-heading mt-4">Three steps to a funded account.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">One evaluation. Clear rules. Real payouts.</p><Link href="/how-it-works" className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--primary)]">See every step <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">{STEPS.map(({icon: Icon, ...s}) => <article key={s.n} className="prop-step relative rounded-xl border border-[var(--border)] bg-[#111811] p-7"><div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#486338] bg-[#203317] text-[var(--primary)]"><Icon size={23} strokeWidth={1.5} /></span><span className="font-mono text-[40px] font-medium tracking-tight text-[#2e3b28]">{s.n}</span></div><h3 className="mt-9 text-xl font-medium tracking-[-.035em]">{s.title}</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{s.text}</p></article>)}</div>
      </section>
      <div className="prop-accounts relative border-y border-[var(--border)] bg-[#10160f]"><AccountSelector /></div>
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2">
        <div className="relative rounded-2xl border border-[#35492c] bg-gradient-to-br from-[#1c2a17] to-[#10170f] p-6 sm:p-9">
          <div className="flex items-center justify-between border-b border-[#36462e] pb-6"><span className="text-xs text-[#bbcdb0]">{FEATURED.label.toUpperCase()} EVALUATION</span><ShieldCheck size={24} className="text-[var(--primary)]" /></div>
          {[["Daily loss limit", formatInr(FEATURED_LIMITS.dailyLoss), `${R.dailyLossPercent}% of your starting balance.`, "38%"], ["Max drawdown", formatInr(FEATURED_LIMITS.maximumLoss), "Trails your end-of-day high, then stops at your starting balance.", "60%"], ["Profit target", formatInr(FEATURED_LIMITS.profitTarget), `${R.targetPercent}% in at least ${R.minimumDays} trading days.`, "82%"]].map(([label, value, text, width]) => <div key={label} className="border-b border-[#2a3a24] py-6 last:border-0"><div className="flex justify-between text-sm"><span className="text-[#c7d4bf]">{label}</span><strong className="font-medium text-[var(--primary)]">{value}</strong></div><div className="mt-3 h-1 rounded-full bg-[#293a21]"><div style={{width}} className="h-full rounded-full bg-[#8bbd56]" /></div><p className="mt-2 text-[10px] text-[#8b9d7e]">{text}</p></div>)}
        </div>
        <div><p className="terminal-label">Simple rules</p><h2 className="prop-heading mt-5">No hidden rules.<br /><span className="text-[var(--primary)]">No surprises.</span></h2><p className="mt-6 max-w-lg text-sm leading-7 text-[var(--muted)]">Every limit is on your dashboard from your first trade. Know your target, your drawdown and your position size before you start.</p><ul className="mt-7 space-y-4 text-sm text-[#c1cdb9]">{["End-of-day trailing drawdown", `${R.dailyLossPercent}% daily loss limit`, `${R.minimumDays} minimum trading days`, "Intraday only: flat by 15:20 IST"].map(t=><li key={t} className="flex items-center gap-3"><Check size={15} className="text-[var(--primary)]" />{t}</li>)}</ul><Link href="/rules" className="prop-button-outline mt-8">See all rules <ArrowUpRight size={16} /></Link></div>
      </section>
      <section aria-labelledby="india-title" className="border-t border-[var(--border)] bg-[#0d130d]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="max-w-2xl"><p className="terminal-label">Built for India</p><h2 id="india-title" className="prop-heading mt-4">Made for Indian index traders.</h2><p className="mt-4 text-sm leading-7 text-[var(--muted)]">Not a US prop firm with rupee prices. Every rule, cost and contract is built around NSE and BSE.</p></div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">{INDIA_FEATURES.map(({ icon: Icon, title, text }) => <article key={title} className="bg-[#101710] p-7"><Icon size={24} strokeWidth={1.5} className="text-[var(--primary)]" aria-hidden="true" /><h3 className="mt-6 text-lg font-medium tracking-tight">{title}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{text}</p></article>)}</div>
        </div>
      </section>
      <section className="border-y border-[var(--border)] bg-[#11180f]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="terminal-label">Free resources</p><h2 className="prop-heading mt-4">Everything you need to pass.</h2></div><Link href="/academy" className="inline-flex items-center gap-2 text-xs text-[var(--primary)]">Explore SVAN Academy <ArrowUpRight size={15} /></Link></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{[{icon:BookOpen,title:"SVAN Academy",text:"Lessons on drawdown, position sizing and every evaluation rule. Free sample lessons available now.",label:"Start learning",href:"/academy"},{icon:Gauge,title:"Risk practice",text:"See how position size and the daily loss limit interact before you start an evaluation.",label:"Try the exercise",href:"/academy#practice"},{icon:Headphones,title:"Help center",text:"Answers on evaluations, funded accounts, payouts and KYC.",label:"Visit the help center",href:"/help"}].map(({icon:Icon,...item})=><article key={item.title} className="rounded-xl border border-[#2d3a27] bg-[#0d140d] p-7"><Icon size={27} strokeWidth={1.4} className="text-[#baf277]" /><h3 className="mt-8 text-xl font-medium tracking-tight">{item.title}</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.text}</p><Link href={item.href} className="mt-7 inline-flex items-center gap-2 text-xs text-[#c7e5af]">{item.label}<ArrowRight size={14} /></Link></article>)}</div>
        </div>
      </section>
      <section id="faq" className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-24"><div className="mb-10 text-center"><p className="terminal-label">FAQ</p><h2 className="prop-heading mt-4">Frequently asked questions</h2></div><div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{FAQ.map(([q,a])=><details key={q} className="group py-1"><summary className="flex list-none items-center justify-between gap-5 py-6 text-sm font-medium sm:text-base">{q}<ChevronDown size={17} className="shrink-0 text-[#9db687] transition-transform group-open:rotate-180" /></summary><p className="max-w-3xl pb-6 pr-6 text-sm leading-7 text-[var(--muted)]">{a}</p></details>)}</div><p className="mt-6 text-center text-xs text-[var(--muted)]">More answers in the <Link href="/help" className="text-[var(--primary)]">help center</Link>.</p></section>
      <section className="px-5 pb-20 sm:px-8"><div className="prop-final relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#486337] bg-[#192613] px-6 py-16 text-center sm:py-20"><BadgeIndianRupee size={31} strokeWidth={1.4} className="mx-auto mb-6 text-[#baf277]" aria-hidden="true" /><h2 className="prop-heading relative">Ready to get funded?</h2><p className="relative mx-auto mt-5 max-w-lg text-sm leading-7 text-[#aabd9a]">Create your account, choose your account size and pay. Three steps, then you&apos;re trading.</p><Link href="/checkout" className="prop-button relative mt-8">Start your evaluation <ArrowUpRight size={17} /></Link>{DEMO_CHECKOUT ? <p className="relative mx-auto mt-8 max-w-md border-t border-[#36492b] pt-8 text-xs leading-6 text-[#aabd9a]">Demo open: new accounts get {formatInr(DEMO_CREDIT)} of virtual credit to pay with. Nobody is charged.</p> : <div className="relative mx-auto mt-10 flex max-w-md flex-col items-center gap-3 border-t border-[#36492b] pt-8"><p className="text-xs text-[#aabd9a]">Launching soon. Get early access when evaluations open.</p><WaitlistForm cta="Get early access" /></div>}</div></section>
    </main>
    <SiteFooter />
  </div>;
}
