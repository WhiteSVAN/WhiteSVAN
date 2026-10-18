import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp, Wallet } from "lucide-react";
import { requireMember } from "@/lib/auth/dal";
import { PROGRAMME_RULES as R } from "@/lib/prop-firm";

export const metadata: Metadata = { title: "Payouts · WhiteSVAN" };

export default async function PayoutsPage() {
  await requireMember();

  return (
    <div className="space-y-8">
      <div>
        <p className="terminal-label">Payouts</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Payouts</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">Request payouts from your funded account and track every payment here.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]" aria-labelledby="payout-history-title">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
          <h2 id="payout-history-title" className="text-base font-medium">Payout history</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">No payouts yet</span>
        </div>
        <div className="flex min-h-[330px] flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card-raised)] text-[var(--primary)]"><Wallet className="h-6 w-6" aria-hidden="true" /></div>
          <h3 className="mt-5 text-xl font-medium tracking-tight">Payouts start with a funded account</h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">Pass an evaluation and complete KYC, then request a payout twice a month at an {R.contractorSharePercent}% profit split, up to the cap for your account size.</p>
          <Link href="/evaluations" className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Choose your account <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </section>

      <Link href="/help#payouts" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-6 transition hover:border-[var(--border-strong)]">
        <span className="flex items-center gap-4"><CircleHelp className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" /><span><span className="block text-sm font-medium">How payouts work</span><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Profit split, payout caps, the buffer and the schedule.</span></span></span>
        <ArrowRight className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
      </Link>
    </div>
  );
}
