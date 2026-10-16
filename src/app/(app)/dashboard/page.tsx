import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, ChartNoAxesCombined, CircleHelp, Wallet } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { WaitlistForm } from "@/app/waitlist-form";

export const metadata: Metadata = { title: "My accounts · WhiteSVAN" };

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  const importedAccountCount = await prisma.tradingAccount.count({ where: { userId: user.id } });
  const firstName = (user.name ?? user.profile?.displayName)?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="terminal-label">Trader dashboard</p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">My accounts</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {firstName ? `Welcome back, ${firstName}. ` : "Welcome to WhiteSVAN. "}
            Evaluations are launching soon.
          </p>
        </div>
        <Link href="/evaluations" className="inline-flex min-h-11 items-center gap-3 rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]">
          Choose your account <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <section aria-labelledby="accounts-title" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
          <h2 id="accounts-title" className="text-base font-medium">Evaluation &amp; funded accounts</h2>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Launching soon</span>
        </div>
        <div className="relative flex min-h-[310px] flex-col items-center justify-center overflow-hidden px-6 py-14 text-center">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(186,242,119,0.07),transparent_65%)]" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--card-raised)] text-[var(--primary)]">
            <ChartNoAxesCombined className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="relative mt-5 text-xl font-medium tracking-tight">No accounts yet</h3>
          <p className="relative mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">Evaluations are launching soon. Join the early-access list and we&apos;ll email you when you can start.</p>
          <div className="relative mt-6 flex w-full justify-center">
            <WaitlistForm defaultEmail={user.email ?? undefined} />
          </div>
          <Link href="/evaluations" className="relative mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--primary)]">
            Compare accounts <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: BookOpen, title: "SVAN Academy", text: "Free lessons on the rules, position sizing and risk, built to help you pass.", href: "/academy", action: "Start learning" },
          { icon: Wallet, title: "Payouts", text: "Profit split, payout caps and the schedule for funded accounts.", href: "/payouts", action: "View payouts" },
          { icon: CircleHelp, title: "Help center", text: "Answers on evaluations, rules, funded accounts and KYC.", href: "/help", action: "Visit the help center" },
        ].map(({ icon: Icon, title, text, href, action }) => (
          <Link key={href} href={href} className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition hover:border-[var(--border-strong)] hover:bg-[var(--card-raised)]">
            <Icon className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
            <h2 className="mt-5 text-base font-medium">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-xs text-[var(--primary)]">{action}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
        ))}
      </div>

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-[var(--border)] bg-[var(--card-deep)] px-6 py-5" aria-label="Trading tools">
        <div>
          <p className="text-sm font-medium">Trading journal</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{importedAccountCount > 0 ? `${importedAccountCount} imported account${importedAccountCount === 1 ? "" : "s"} in your performance tools. ` : "Import history, review performance and keep your trading record. "}Journal records are separate from WhiteSVAN evaluation accounts.</p>
        </div>
        <Link href="/journal" className="inline-flex min-h-10 shrink-0 items-center gap-2 text-sm text-[var(--primary)]">{user.role === "CLIENT" ? "Open research workspace" : "Open journal"} <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
