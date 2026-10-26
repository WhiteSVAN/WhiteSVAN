import type { Metadata } from "next";
import { PropHeader } from "@/components/prop-firm/site-header";
import { RuleBook } from "@/components/prop-firm/rule-book";
import { SiteFooter } from "@/components/site-footer";
import { PROGRAMME_RULES as R, RULE_GROUPS } from "@/lib/prop-firm";

export const metadata: Metadata = {
  title: "Trading rules | WhiteSVAN",
  description: "Every WhiteSVAN rule in plain words and in exact terms: profit target, daily loss limit, end-of-day drawdown, trading hours, products and payouts.",
};

const RULE_COUNT = RULE_GROUPS.reduce((count, group) => count + group.rules.length, 0);

/** The rulebook: the one place every rule is written down. Other pages link here. */
export default function RulesPage() {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <PropHeader />
    <main id="main-content">
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <p className="terminal-label">Trading rules · {R.version}</p>
          <h1 className="mt-4 text-5xl sm:text-6xl">The rules.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">{RULE_COUNT} rules decide every pass, breach and payout. Each one is written twice: in plain words with the amounts for your account size, then exactly, for experienced traders.</p>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <RuleBook />
      </div>
    </main>
    <SiteFooter />
  </div>;
}
