import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, ClipboardCheck, FileText, GraduationCap } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LearnPanel } from "@/components/academy/learn-panel";
import { RuleExercise } from "@/components/academy/rule-exercise";
import { EVALUATION_PLANS, formatInr, PROGRAMME_RULES as R, PROGRAMME_STEPS } from "@/lib/prop-firm";

export const metadata: Metadata = {
  title: "SVAN Academy | WhiteSVAN",
  description: "Free lessons on NIFTY, BANK NIFTY and SENSEX futures and options, position sizing and every evaluation rule, plus a drawdown exercise to practise before you trade.",
};

// The "consultants" key is kept so existing ?tab= links keep working.
const SECTIONS = [
  { key: "learn", label: "Lessons", icon: BookOpen },
  { key: "evaluations", label: "Rule practice", icon: ClipboardCheck },
  { key: "consultants", label: "Getting funded", icon: FileText },
] as const;

const JOURNEY = [
  { number: "01", title: "Learn", detail: "Contracts, costs, position sizing and every evaluation rule, with worked examples." },
  { number: "02", title: "Practise", detail: "Run the drawdown and daily loss exercise before you trade an evaluation." },
  { number: "03", title: "Get funded", detail: `Pass the evaluation, complete KYC and start requesting payouts at an ${R.contractorSharePercent}% profit split.` },
];

export default async function AcademyPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const active = SECTIONS.find((section) => section.key === tab)?.key ?? "learn";

  return (
    <div className="min-h-full flex-1 bg-[var(--background)] text-[var(--foreground)]">
      <a href="#academy-main" className="fixed -top-20 left-5 z-50 rounded bg-[var(--primary)] px-4 py-3 text-sm text-[var(--primary-foreground)] focus:top-3">Skip to content</a>
      <PropHeader />

      <main id="academy-main">
        <section className="terminal-grid border-b border-[var(--border)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <p className="terminal-label flex items-center gap-2"><GraduationCap className="h-4 w-4" aria-hidden="true" /> SVAN Academy</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.05em] sm:text-6xl">Learn the rules.<br /><span className="text-[var(--primary)]">Pass the evaluation.</span></h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[var(--muted)]">Free lessons on NIFTY, BANK NIFTY and SENSEX futures and options, position sizing and every evaluation rule, built to get you funded.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/academy?tab=learn#academy-content" className="inline-flex min-h-11 items-center gap-3 rounded-md bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start learning <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/evaluations" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border-strong)] px-4 text-sm hover:bg-[var(--card-raised)]">See evaluations <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
              <p className="mt-4 text-xs leading-6 text-[var(--muted)]">Free lessons and the rule exercise are open now. The full Academy launches with evaluations.</p>
            </div>
            <ol className="terminal-card divide-y divide-[var(--border)] px-5 sm:px-7" aria-label="Your path to a funded account">
              {JOURNEY.map((step) => <li key={step.number} className="flex gap-5 py-6">
                <span className="mt-1 font-mono text-xs text-[var(--primary)]">{step.number}</span>
                <div><h2 className="text-base font-medium">{step.title}</h2><p className="mt-2 text-xs leading-6 text-[var(--muted)]">{step.detail}</p></div>
              </li>)}
            </ol>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-8 sm:pb-24">
          <nav aria-label="Academy sections" className="border-b border-[var(--border)]">
            <ul className="-mb-px flex gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
              {SECTIONS.map((section) => { const Icon = section.icon; return <li key={section.key} className="shrink-0"><Link href={`/academy?tab=${section.key}`} scroll={false} aria-current={active === section.key ? "page" : undefined} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-medium ${active === section.key ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"}`}><Icon className="h-4 w-4" aria-hidden="true" />{section.label}</Link></li>; })}
            </ul>
          </nav>

          <section id="academy-content" className="scroll-mt-28 pt-8" aria-labelledby={active === "learn" ? "sample-lessons-title" : "academy-section-title"}>
            {active === "learn" ? <LearnPanel /> : active === "evaluations" ? <>
              <SectionHeading eyebrow="Rule practice" title="Practise the rules before you pay." body="Try the evaluation rules on a sample account: see how the drawdown and the daily loss limit move as your balance changes." />
              <div className="my-7 grid gap-4 md:grid-cols-3">
                <InfoCard number="A" title="Know the price">See the fee, the account size and every rule before you start. One-time fee, GST included.</InfoCard>
                <InfoCard number="B" title="Know the result">Every breach comes with a report showing the trade and the rule. Appeal within 7 days.</InfoCard>
                <InfoCard number="C" title="Know what's next">Pass, complete KYC and sign your funded trader agreement to start earning payouts.</InfoCard>
              </div>
              <RuleExercise />
            </> : <>
              <SectionHeading eyebrow="Getting funded" title="From evaluation to funded account." body="What happens after you pass." />
              <ol className="mt-7 max-w-3xl divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-5 sm:px-7">
                {PROGRAMME_STEPS.map(({ title, body }, index) => <li key={title} className="flex gap-4 py-6"><span className="pt-1 font-mono text-xs text-[var(--primary)]">0{index + 1}</span><div><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p></div></li>)}
              </ol>
            </>}
          </section>

          <section aria-labelledby="start-title" className="mt-12 flex flex-col items-start justify-between gap-6 rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-7 sm:flex-row sm:items-center sm:p-9">
            <div><h2 id="start-title" className="text-2xl font-medium tracking-tight">Evaluations from {formatInr(EVALUATION_PLANS[0].fee)}.</h2><p className="mt-2 text-sm text-[var(--muted)]">One-time fee, GST included. No subscription, no activation fee.</p></div>
            <Link href="/checkout" className="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-full bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Start your evaluation <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <div className="max-w-3xl"><p className="terminal-label">{eyebrow}</p><h2 id="academy-section-title" className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p></div>;
}

function InfoCard({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <article className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"><span className="font-mono text-[10px] text-[var(--primary)]">{number}</span><h3 className="mt-4 font-medium">{title}</h3><p className="mt-3 text-xs leading-6 text-[var(--muted)]">{children}</p></article>;
}
