import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, ClipboardCheck, FileText, GraduationCap, LockKeyhole } from "lucide-react";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LearnPanel } from "@/components/academy/learn-panel";
import { RuleExercise } from "@/components/academy/rule-exercise";

export const metadata: Metadata = {
  title: "Academy preview | WhiteSVAN",
  description: "Explore sample lessons, synthetic rule reviews and the proposed contractor pathway for an India-focused trading education programme.",
};

const SECTIONS = [
  { key: "learn", label: "Learn", icon: BookOpen },
  { key: "evaluations", label: "Evaluation preview", icon: ClipboardCheck },
  { key: "consultants", label: "Contractor pathway", icon: FileText },
] as const;

const JOURNEY = [
  { number: "01", title: "Build understanding", detail: "Study contracts, costs and risk. Keep your review in the journal." },
  { number: "02", title: "Demonstrate a process", detail: "A planned simulated assessment, with explicit rules and review." },
  { number: "03", title: "Enter selection review", detail: "Potential contractor engagement through a separate agreement." },
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
              <p className="terminal-label flex items-center gap-2"><GraduationCap className="h-4 w-4" aria-hidden="true" /> India / education and trading discipline</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.05em] sm:text-6xl">Learn the process.<br /><span className="text-[var(--primary)]">Review the evidence.</span></h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[var(--muted)]">A new learning layer around your trading journal. Explore the foundations for NIFTY, BANK NIFTY and SENSEX futures and options, then see how a transparent assessment could work.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/academy?tab=learn#academy-content" className="inline-flex min-h-11 items-center gap-3 rounded-md bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Explore sample lessons <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/journal" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border-strong)] px-4 text-sm hover:bg-[var(--card-raised)]">Open your journal <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
              <p className="mt-4 text-xs leading-6 text-[var(--muted)]">Sample lessons and fictional exercises are available here. The paid programme is in development; prices and final terms have not been announced.</p>
            </div>
            <ol className="terminal-card divide-y divide-[var(--border)] px-5 sm:px-7" aria-label="Proposed programme journey">
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
              <SectionHeading eyebrow="02 / Simulated assessment preview" title="Rules you can read. Results you can explain." body="The planned paid evaluation will be separate from education. This preview explains the experience; it does not enrol you, grade your trading or create a funded account." />
              <div className="my-7 grid gap-4 md:grid-cols-3">
                <InfoCard number="A" title="Before an attempt">See the exact price, what it buys, the rule version, simulation conditions and applicable refund terms before accepting.</InfoCard>
                <InfoCard number="B" title="After a result">Inspect the calculation and supporting record. Assessment appeals and billing questions have separate review routes.</InfoCard>
                <InfoCard number="C" title="Before engagement">Passing an evaluation and receiving a contractor agreement are distinct stages. Final selection terms are still being developed.</InfoCard>
              </div>
              <RuleExercise />
            </> : <>
              <SectionHeading eyebrow="03 / Proposed contractor pathway" title="An assessment is one part of the record." body="The intended pathway is to engage selected traders as consultants. A simulated result, a selection decision and permission to trade company capital each mean something different." />
              <div className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
                <ol className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-5 sm:px-7">
                  {[
                    ["Evidence review", "Review the assessment, its coverage and any unresolved appeal. Course completion and assessment performance remain separate."],
                    ["Selection decision", "Confirm eligibility and the actual services needed. The final offer policy and engagement capacity will be published before paid evaluations open."],
                    ["Contractor agreement", "A separate agreement defines services, responsibilities, compensation, confidentiality and termination."],
                    ["Authorised firm access", "Any real-capital activity requires the firm’s account approval, named-person access, risk limits and supervision. A virtual balance is not deployable capital."],
                  ].map(([title, body], index) => <li key={title} className="flex gap-4 py-6"><span className="pt-1 font-mono text-xs text-[var(--primary)]">0{index + 1}</span><div><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p></div></li>)}
                </ol>
                <aside className="self-start rounded-lg border border-[var(--border-strong)] bg-[var(--card)] p-6">
                  <LockKeyhole className="h-6 w-6 text-[var(--primary)]" aria-hidden="true" />
                  <h3 className="mt-5 text-xl font-medium">Keep building your record.</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Continue journaling, inspect your source coverage and document how you review risk. Your existing journal works independently of this planned programme.</p>
                  <Link href="/journal" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--primary)]">Go to your journal <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                  <p className="mt-4 border-t border-[var(--border)] pt-4 text-xs leading-6 text-[var(--muted)]">Contractor applications are not open. This preview does not offer a contract, income or capital allocation.</p>
                </aside>
              </div>
            </>}
          </section>

          <section aria-labelledby="commercial-title" className="mt-12 grid gap-6 border-t border-[var(--border)] pt-9 lg:grid-cols-[.7fr_1.3fr]">
            <div><p className="terminal-label">Proposed commercial model</p><h2 id="commercial-title" className="mt-3 text-2xl font-medium tracking-tight">Two paid products.<br />Clear, separate terms.</h2><p className="mt-3 text-xs leading-6 text-[var(--muted)]">No payments are accepted in this preview. Whether a course is required before an evaluation remains undecided.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard number="01" title="Paid education">Learning content, support and access duration will be described with the course price. Completion is a learning outcome.</InfoCard>
              <InfoCard number="02" title="Paid simulated evaluation">Assessment access and its rules will have their own price and terms. Any retake, renewal or additional charge must be disclosed before payment.</InfoCard>
            </div>
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
