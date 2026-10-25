import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, ChartNoAxesCombined, ShieldCheck } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HELP_TOPICS } from "@/lib/help-center";
import { EVALUATION_PLANS, formatInr, PROGRAMME_RULES as R, PROGRAMME_STEPS } from "@/lib/prop-firm";
import { clockSeconds } from "@/lib/trading/time";

const FIRST = EVALUATION_PLANS[0];
const LAST = EVALUATION_PLANS[EVALUATION_PLANS.length - 1];

export const metadata: Metadata = {
  title: "How it works | WhiteSVAN",
  description: `Pass one evaluation on NIFTY, BANK NIFTY and SENSEX options, get a funded account and keep ${R.contractorSharePercent}% of the profit.`,
};

const hhmm = (seconds: number) =>
  `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}`;

/** The detail behind each of the three programme steps. */
const DETAILS = [
  {
    icon: ChartNoAxesCombined,
    points: [
      `Daily loss limit: ${R.dailyLossPercent}% of your starting balance, on open and closed P&L`,
      `Max drawdown: ${R.maximumLossPercent}%, trailing your highest end-of-day balance and stopping at your starting balance`,
      `When you pass, your best day is no more than ${R.consistencyPercent}% of your total profit`,
    ],
    link: { href: "/academy?tab=evaluations", label: "Try the rules on a sample week" },
  },
  {
    icon: ShieldCheck,
    points: ["KYC: PAN, Aadhaar through DigiLocker and a bank account check", "Your agreement sets the split, payout caps and limits", "Same loss limits, no profit target"],
    link: { href: "/rules#desk", label: "Funded account rules" },
  },
  {
    icon: BadgeIndianRupee,
    points: ["Request a payout whenever you have eligible profit", `Caps from ${formatInr(FIRST.payoutCap)} to ${formatInr(LAST.payoutCap)} a payout, by account size`, "Profit equal to your max drawdown stays in the account as a buffer"],
    link: { href: "/funded#calculator", label: "Work out a payout" },
  },
];

const TRADING_DAY = [
  { time: R.marketOpen, title: "The market opens", body: "Trade NIFTY and BANK NIFTY options on NSE and SENSEX options on BSE. Your loss limits count open and closed P&L all day." },
  { time: R.squareOff, title: "Square-off", body: `Anything still open is closed for you and working orders are cancelled. On expiry day, no new positions in expiring contracts after ${hhmm(clockSeconds(R.marketClose) - R.expiryCutoffMinutes * 60)}.` },
  { time: R.marketClose, title: "The day closes", body: "Your closing balance is recorded, the drawdown floor moves up if you closed at a new high, and the pass check runs." },
];

const FAQ_IDS = ["rule-breach", "real-money", "deposits"];
const FAQ = FAQ_IDS.flatMap((id) => HELP_TOPICS.flatMap((topic) => topic.articles).filter((article) => article.id === id));

export default function HowItWorksPage() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <div className="border-b border-[var(--border)] px-5 pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <p className="terminal-label text-[var(--primary)]">How it works</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-medium leading-[1.04] tracking-[-.055em] sm:text-7xl">Pass. Get funded.<br /><span className="text-[var(--primary)]">Get paid.</span></h1>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/checkout" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--primary)] px-7 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start your evaluation <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/rules" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border-strong)] px-6 text-sm hover:bg-[var(--card-raised)]">Read the rules</Link>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="steps-title">
        <h2 id="steps-title" className="sr-only">Three steps to a payout</h2>
        <ol className="grid gap-5 lg:grid-cols-3">
          {PROGRAMME_STEPS.map(({ title, body }, index) => {
            const { icon: Icon, points, link } = DETAILS[index];
            return <li key={title} className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-7">
              <div className="flex items-center justify-between"><Icon size={24} className="text-[var(--primary)]" aria-hidden="true" /><span className="font-mono text-sm text-[var(--faint)]">0{index + 1}</span></div>
              <h3 className="mt-8 text-2xl font-medium tracking-[-.03em]">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p>
              <ul className="mt-5 space-y-2 border-t border-[var(--border)] pt-5 text-sm">
                {points.map((point) => <li key={point} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden="true" />{point}</li>)}
              </ul>
              <Link href={link.href} className="mt-auto inline-flex items-center gap-2 pt-6 text-sm text-[var(--primary)]">{link.label} <ArrowRight size={15} aria-hidden="true" /></Link>
            </li>;
          })}
        </ol>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--card-deep)] py-16 sm:py-20" aria-labelledby="day-title">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <p className="terminal-label">Your trading day</p>
          <h2 id="day-title" className="mt-4 text-3xl font-medium tracking-[-.04em] sm:text-4xl">Intraday, on IST.</h2>
          <ol className="mt-10 border-l border-[var(--border-strong)]">
            {TRADING_DAY.map((moment) => <li key={moment.title} className="relative pb-8 pl-8 last:pb-0">
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />
              <p className="font-mono text-xs text-[var(--primary)]">{moment.time}</p>
              <h3 className="mt-1 text-lg font-medium">{moment.title}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">{moment.body}</p>
            </li>)}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]" aria-labelledby="faq-title">
        <div><p className="terminal-label text-[var(--primary)]">FAQ</p><h2 id="faq-title" className="mt-4 text-4xl font-medium leading-tight tracking-[-.04em]">Common questions</h2><Link href="/help" className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--primary)]">Visit the help center <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{FAQ.map((article) => <details key={article.id} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-sm font-medium [&::-webkit-details-marker]:hidden">{article.question}<span className="text-xl font-light text-[var(--primary)] group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-4 max-w-xl pr-7 text-sm leading-7 text-[var(--muted)]">{article.answer}</p></details>)}</div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8" aria-labelledby="start-title">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-7 sm:flex-row sm:items-center sm:p-9">
          <div><h2 id="start-title" className="text-2xl font-medium tracking-tight">Evaluations from {formatInr(FIRST.fee)}.</h2><p className="mt-2 text-sm text-[var(--muted)]">One-time fee, GST included. No subscription, no activation fee.</p></div>
          <Link href="/checkout" className="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-full bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start your evaluation <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
