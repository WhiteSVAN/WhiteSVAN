import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, ClipboardCheck, ShieldCheck } from "lucide-react";
import { AccountSelector } from "@/components/prop-firm/account-selector";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Evaluation accounts | WhiteSVAN",
  description: "Compare WhiteSVAN's proposed Indian index evaluation accounts, one-time fees and transparent risk rules. Programme preview; purchases are not open.",
};

export default function EvaluationsPage() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <div className="border-b border-[var(--border)] bg-[radial-gradient(ellipse_at_50%_0%,rgba(186,242,119,.09),transparent_70%)] px-5 pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <p className="terminal-label text-[var(--primary)]">The WhiteSVAN evaluation</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-medium leading-[1.04] tracking-[-.055em] sm:text-7xl">Your skill.<br />A bigger <span className="text-[var(--primary)]">opportunity.</span></h1>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">Prove your process on Indian index markets. Start with a simulated evaluation and work towards our proposed contractor desk.</p>
        <a href="#accounts" className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--primary)] px-7 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Explore accounts <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <AccountSelector />
      <section className="border-y border-[var(--border)] bg-[var(--card-deep)] py-16 sm:py-20" aria-labelledby="evaluation-path-title">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="terminal-label">A process you can follow</p><h2 id="evaluation-path-title" className="mt-4 text-3xl font-medium tracking-[-.04em] sm:text-4xl">Three steps. One clear path.</h2></div><Link href="/rules" className="flex items-center gap-2 text-sm text-[var(--primary)]">Read the rulebook <ArrowRight size={15} aria-hidden="true" /></Link></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{[
            { icon: ClipboardCheck, number: "01", title: "Pick your evaluation", body: "Choose a simulated balance that fits your risk style. Review the one-time fee, limits and final terms before purchases open." },
            { icon: ChartNoAxesCombined, number: "02", title: "Demonstrate consistency", body: "Aim for 6% across at least five trading days. Respect the daily loss, end-of-day drawdown and best-day consistency rules." },
            { icon: ShieldCheck, number: "03", title: "Enter the sim desk", body: "A pass leads to KYC and a separate contractor agreement. The proposed 80% share is subject to eligible profits, buffers and cycle caps." },
          ].map(({ icon: Icon, number, title, body }) => <article key={number} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-7"><div className="flex items-center justify-between"><Icon size={24} className="text-[var(--primary)]" aria-hidden="true" /><span className="font-mono text-sm text-[var(--faint)]">{number}</span></div><h3 className="mt-8 text-xl font-medium">{title}</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p></article>)}</div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
        <div><p className="terminal-label text-[var(--primary)]">Before you begin</p><h2 className="mt-4 text-4xl font-medium leading-tight tracking-[-.04em]">Good questions.<br /><span className="text-[var(--muted)]">Straight answers.</span></h2><p className="mt-5 max-w-sm text-sm leading-7 text-[var(--muted)]">Know what you are choosing before you commit. Explore the draft programme and try an educational rule exercise today.</p><Link href="/academy?tab=evaluations#academy-content" className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--primary)]">Try the rule exercise <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{[
          ["Can I buy an evaluation now?", "No. The programme is in preview. These are proposed fees and draft rules, not an active checkout. Purchases will open only after final terms and operational readiness are published."],
          ["Is the displayed account balance real capital?", "No. Evaluation and contractor accounts are simulated. The account size defines the risk budget; you do not receive that amount as cash or a deposit."],
          ["Is the fee monthly?", "The draft model uses a one-time evaluation fee, inclusive of GST. This preview does not charge a fee, start an attempt or create a recurring subscription. Final access, refund and retake terms must be disclosed before launch."],
          ["Does passing guarantee a payout?", "No. Passing is followed by KYC and a separate contractor agreement. Proposed compensation depends on eligible simulated net profits, retained buffers, cycle caps and review. Returns or income are not guaranteed."],
        ].map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex list-none items-center justify-between gap-5 text-sm font-medium [&::-webkit-details-marker]:hidden">{question}<span className="text-xl font-light text-[var(--primary)] group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-4 max-w-xl pr-7 text-sm leading-7 text-[var(--muted)]">{answer}</p></details>)}</div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
