import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, CircleHelp, ScrollText } from "lucide-react";
import { AccountMeters } from "@/components/markets/account-panel";
import { STATUS_BADGE } from "@/components/markets/account-status";
import { tradingNow } from "@/lib/accounts/clock";
import { loadAccounts, waitingPasses } from "@/lib/accounts/store";
import { requireMember } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { findAccountPlan, PROGRAMME_RULES } from "@/lib/prop-firm";
import { activateFunded } from "./activate-funded";

const openedText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export const metadata: Metadata = { title: "My accounts · WhiteSVAN" };

/**
 * The trader's demo accounts (evaluations) and the funded accounts their passes opened. A pass made
 * while the trader had the most funded accounts open waits here, and activates once one ends.
 */
export default async function DashboardPage() {
  const user = await requireMember();
  const accounts = await loadAccounts(user.id, tradingNow());
  const waiting = waitingPasses(accounts);
  const fundedFull = accounts.filter((account) => account.phase === "FUNDED" && account.status === "ACTIVE").length >= PROGRAMME_RULES.maximumFundedAccounts;
  const firstName = (user.name ?? user.profile?.displayName)?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-medium tracking-[-0.045em] sm:text-4xl">My accounts</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {firstName ? `Welcome back, ${firstName}. ` : "Welcome to WhiteSVAN. "}
            {accounts.length > 0 ? `You have ${accounts.length} account${accounts.length === 1 ? "" : "s"}.` : "Pick an account size to start your first evaluation."}
          </p>
        </div>
        <Link href="/checkout" className="inline-flex min-h-11 items-center gap-3 rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-[var(--ink-foreground)] transition hover:bg-[var(--ink-hover)]">
          Start an evaluation <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <section aria-labelledby="accounts-title" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
          <h2 id="accounts-title" className="text-base font-medium">Demo &amp; funded accounts</h2>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">{accounts.length > 0 ? `${accounts.length} total` : "None yet"}</span>
        </div>
        {accounts.length > 0 ? (
          <ul className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
            {accounts.map((account) => {
              const plan = findAccountPlan(account.planId);
              const status = STATUS_BADGE[account.status];
              const name = `${plan?.label ?? account.planId} ${account.phase === "FUNDED" ? "funded account" : "demo account"}`;
              const activatable = waiting.has(account.id) && !fundedFull;
              const primary = "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-[var(--ink-foreground)] hover:bg-[var(--ink-hover)]";
              return (
                <li key={account.id}>
                  <article className="flex h-full flex-col gap-5 rounded-xl border border-[var(--border)] bg-[var(--card-deep)] p-5" aria-label={name}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">{name}</h3>
                        <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{accountNumber(account.id, account.planId)} · opened {openedText.format(account.createdAt)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${status.className}`}>{status.text}</span>
                    </div>
                    <AccountMeters
                      desk={account.desk}
                      passNote={!waiting.has(account.id) ? null : activatable ? "Your funded account is ready to activate." : `Your funded account is waiting: you have ${PROGRAMME_RULES.maximumFundedAccounts} open, the most at a time. Activate it here once one of them ends.`}
                    />
                    <div className="mt-auto flex flex-wrap gap-2">
                      {activatable ? (
                        <>
                          <form action={activateFunded} className="flex flex-1">
                            <input type="hidden" name="account" value={account.id} />
                            <button type="submit" className={primary}>Activate funded account <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
                          </form>
                          <Link href={`/trade/${account.id}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-strong)] px-5 text-sm hover:bg-[var(--card-raised)]">Open account</Link>
                        </>
                      ) : (
                        <Link href={`/trade/${account.id}`} className={primary}>{account.status === "ACTIVE" ? "Start trading" : "Open account"} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                      )}
                      {account.phase === "FUNDED" && <Link href="/payouts" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border-strong)] px-5 text-sm hover:bg-[var(--card-raised)]">Payouts</Link>}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-14 text-center">
            <h3 className="text-xl font-medium tracking-tight">No accounts yet</h3>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">Choose a size and check out, on one screen. Your demo account opens straight away; pass it and your funded account opens.</p>
            <Link href="/checkout" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-[var(--ink-foreground)] hover:bg-[var(--ink-hover)]">Start an evaluation <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: ScrollText, title: "Rules", text: "Every limit, and how it's checked.", href: "/rules", action: "Read the rules" },
          { icon: BookOpen, title: "SVAN Academy", text: "Free lessons on the rules, position sizing and risk.", href: "/academy", action: "Start learning" },
          { icon: CircleHelp, title: "Help center", text: "Answers on evaluations, payouts and KYC.", href: "/help", action: "Get help" },
        ].map(({ icon: Icon, title, text, href, action }) => (
          <Link key={href} href={href} className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition hover:border-[var(--border-strong)] hover:bg-[var(--card-raised)]">
            <Icon className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
            <h2 className="mt-5 text-base font-medium">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-xs text-[var(--primary)]">{action}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
