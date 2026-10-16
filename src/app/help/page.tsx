import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { HelpCenter } from "@/components/prop-firm/help-center";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WaitlistForm } from "@/app/waitlist-form";

export const metadata: Metadata = {
  title: "Help center | WhiteSVAN",
  description: "Answers about WhiteSVAN's proposed India evaluation accounts, trading rules, the simulated contractor desk, payouts, SVAN Academy and your workspace.",
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PropHeader />
      <main id="main-content">
        <section className="border-b border-[var(--border)] bg-[radial-gradient(ellipse_at_50%_0%,rgba(186,242,119,.09),transparent_70%)] px-5 pb-20 pt-16 text-center sm:px-8 sm:pt-24">
          <p className="terminal-label flex items-center justify-center gap-2 text-[var(--primary)]"><LifeBuoy size={14} aria-hidden="true" /> Help center</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-5xl font-medium leading-[1.05] tracking-[-.055em] sm:text-6xl">How can we help?</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">Evaluations, rules, the sim desk and your workspace. The programme is in launch preview, so prices and rules are drafts until purchases open.</p>
          <HelpCenter />
        </section>
        <section className="px-5 py-20 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-7 sm:p-10 lg:flex-row lg:items-center">
            <div className="max-w-md">
              <h2 className="text-2xl font-medium tracking-[-.035em]">Still have a question?</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Support opens with paid evaluations. Join the launch list and we&apos;ll email you when they open, or read the full draft rulebook now.</p>
              <Link href="/rules" className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--primary)]">Read the rulebook <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
            <WaitlistForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
