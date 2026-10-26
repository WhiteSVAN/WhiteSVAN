import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { HelpCenter } from "@/components/prop-firm/help-center";
import { PropHeader } from "@/components/prop-firm/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Help center | WhiteSVAN",
  description: "Answers about WhiteSVAN evaluations, trading rules, funded accounts and payouts.",
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PropHeader />
      <main id="main-content">
        <section className="border-b border-[var(--border)] px-5 pb-20 pt-16 text-center sm:px-8 sm:pt-24">
          <p className="terminal-label flex items-center justify-center gap-2"><LifeBuoy size={14} aria-hidden="true" /> Help center</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-5xl sm:text-6xl">How can we help?</h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--muted)]">Answers on evaluations, rules and payouts.</p>
          <HelpCenter />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
