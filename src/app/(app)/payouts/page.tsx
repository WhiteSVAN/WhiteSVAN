import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp, Wallet } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Payouts · WhiteSVAN" };

export default async function PayoutsPage() {
  await requireOnboardedUser();

  return (
    <div className="space-y-8">
      <div>
        <p className="terminal-label">Account rewards</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Payouts</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">A clear view of your rewards, requests and payment history.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]" aria-labelledby="payout-history-title">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
          <h2 id="payout-history-title" className="text-base font-medium">Payout history</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Pre-launch</span>
        </div>
        <div className="flex min-h-[330px] flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card-raised)] text-[var(--primary)]"><Wallet className="h-6 w-6" aria-hidden="true" /></div>
          <h3 className="mt-5 text-xl font-medium tracking-tight">Your rewards journey starts with an account</h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">WhiteSVAN account access and payout requests are not open yet. Eligibility, review requirements and payment terms will be published with the programs.</p>
          <Link href="/evaluations" className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Explore evaluations <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </section>

      <Link href="/help" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-6 transition hover:border-[var(--border-strong)]">
        <span className="flex items-center gap-4"><CircleHelp className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" /><span><span className="block text-sm font-medium">Questions about payouts?</span><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Find current program information in the help center.</span></span></span>
        <ArrowRight className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
      </Link>
    </div>
  );
}
