import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CircleHelp, Circle, Wallet } from "lucide-react";
import { STATUS_BADGE } from "@/components/markets/account-status";
import { tradingNow } from "@/lib/accounts/clock";
import { loadAccounts, type StoredAccount } from "@/lib/accounts/store";
import { requireMember } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { findAccountPlan, PROGRAMME_RULES as R } from "@/lib/prop-firm";
import { formatPaise } from "@/lib/trading/money";
import { quotePayout, type PayoutBlock, type PayoutChecks } from "@/lib/trading/payouts";

export const metadata: Metadata = { title: "Payouts · WhiteSVAN" };

/** KYC, the funded trader agreement and bank verification aren't on the platform yet, and no request has been made. */
const CHECKS: PayoutChecks = { kycVerified: false, agreementSigned: false, bankVerified: false, onHold: false };

const signed = (paise: number) => `${paise < 0 ? "−" : ""}${formatPaise(Math.abs(paise), 2)}`;

/** One funded account's payout figures from the rules, and what stands before a request. */
function PayoutCard({ account }: { account: StoredAccount }) {
  const { state } = account.desk;
  const plan = findAccountPlan(account.planId);
  const quote = quotePayout(state, CHECKS);
  const status = STATUS_BADGE[account.status];
  const blocked = (block: PayoutBlock) => quote.blocks.includes(block);
  const figures: [string, string, string][] = [
    ["Balance", formatPaise(state.balance, 2), ""],
    ["Profit", signed(quote.profit), quote.profit > 0 ? "text-[var(--primary)]" : quote.profit < 0 ? "text-[var(--danger)]" : ""],
    ["Buffer, stays in the account", formatPaise(quote.buffer, 2), ""],
    ["Profit above the buffer", formatPaise(quote.withdrawableProfit, 2), ""],
    [`Your ${state.rules.profitSplitPercent}% share`, formatPaise(quote.traderShare, 2), ""],
    [`Payout now, up to ${formatPaise(state.rules.payoutCap, 0)}`, formatPaise(quote.payout, 2), quote.payout > 0 ? "text-[var(--primary)]" : ""],
  ];
  const steps: [string, boolean][] = [
    [`Profit above the ${formatPaise(quote.buffer, 0)} buffer`, !blocked("NO_PROFIT_ABOVE_BUFFER")],
    ["No open positions or orders", !blocked("OPEN_POSITIONS")],
    ["Account active, no breach", !blocked("ACCOUNT_CLOSED")],
    ["KYC: PAN and Aadhaar", !blocked("KYC")],
    ["Funded trader agreement signed", !blocked("AGREEMENT")],
    ["Bank account verified", !blocked("BANK")],
  ];

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)]" aria-label={`${plan?.label ?? account.planId} funded account payouts`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
        <div>
          <h2 className="text-base font-medium">{plan?.label ?? account.planId} funded account</h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{accountNumber(account.id, account.planId)}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${status.className}`}>{status.text}</span>
      </div>
      <div className="grid gap-8 p-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {figures.map(([term, value, tone]) => (
              <div key={term}><dt className="text-xs text-[var(--muted)]">{term}</dt><dd className={`mt-1 font-mono text-lg ${tone}`}>{value}</dd></div>
            ))}
          </dl>
          <p className="mt-6 text-xs leading-6 text-[var(--muted)]">Request a payout whenever you have eligible profit and meet the requirements below, up to your account&apos;s per-request cap. When a payout is paid, the firm&apos;s {100 - state.rules.profitSplitPercent}% share of that profit comes off the balance with it.</p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Before you can request a payout</h3>
          <ul className="mt-3 space-y-2.5 text-sm">
            {steps.map(([text, done]) => (
              <li key={text} className={`flex items-center gap-2.5 ${done ? "" : "text-[var(--muted)]"}`}>
                {done ? <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" /> : <Circle className="h-4 w-4 shrink-0 text-[var(--faint)]" aria-hidden="true" />}
                {text}<span className="sr-only">{done ? " (done)" : " (to do)"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-6 text-[var(--muted)]">We email you to complete KYC, the agreement and your bank details. Requests open once they&apos;re done.</p>
        </div>
      </div>
    </article>
  );
}

export default async function PayoutsPage() {
  const user = await requireMember();
  const now = tradingNow();
  const funded = (await loadAccounts(user.id, now)).filter((account) => account.phase === "FUNDED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Payouts</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">Request a payout whenever you have eligible profit and meet the payout requirements. Your share comes from profit above the buffer, up to your account&apos;s per-request cap.</p>
      </div>

      {funded.length > 0 ? (
        funded.map((account) => <PayoutCard key={account.id} account={account} />)
      ) : (
        <section className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center" aria-label="No funded accounts">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card-raised)] text-[var(--primary)]"><Wallet className="h-6 w-6" aria-hidden="true" /></div>
          <h2 className="mt-5 text-xl font-medium tracking-tight">Payouts start with a funded account</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">Pass your demo account and your funded account opens. Its payout figures show here: an {R.contractorSharePercent}% profit split, with payouts available when you have eligible profit and meet the requirements, up to your account&apos;s per-request cap.</p>
          <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">My accounts <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]" aria-labelledby="payout-history-title">
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <h2 id="payout-history-title" className="text-base font-medium">Payout history</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">No payouts yet</span>
        </div>
      </section>

      <Link href="/help#payouts" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-6 transition hover:border-[var(--border-strong)]">
        <span className="flex items-center gap-4"><CircleHelp className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" /><span><span className="block text-sm font-medium">How payouts work</span><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Profit split, payout caps, the buffer and eligibility.</span></span></span>
        <ArrowRight className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
      </Link>
    </div>
  );
}
