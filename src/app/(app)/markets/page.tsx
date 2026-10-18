import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConnectZerodha } from "@/components/markets/connect-zerodha";
import { ZerodhaCharts } from "@/components/markets/zerodha-charts";
import { ZerodhaNotice } from "@/components/markets/zerodha-notice";
import { requireUser } from "@/lib/auth/dal";
import { currentKiteSession } from "@/lib/zerodha/access";
import { isKiteOwner, kiteConfig } from "@/lib/zerodha/config";

export const metadata: Metadata = { title: "Zerodha charts · WhiteSVAN", robots: { index: false } };

const sessionEnd = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Charts on the firm's own Zerodha account. A 404 for everyone not in KITE_OWNER_EMAILS. */
export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ zerodha?: string }> }) {
  const user = await requireUser();
  const config = kiteConfig();
  if (!isKiteOwner(config, user.email)) notFound();
  const session = await currentKiteSession({ userId: user.id, config });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="terminal-label">Firm tools</p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Zerodha charts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">NIFTY, BANK NIFTY and SENSEX: the index, futures and options, with live prices and market depth from the firm&apos;s Zerodha account. To trade, open an evaluation account from My accounts.</p>
        </div>
        {session && (
          <form action="/api/zerodha/logout" method="post" className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
            <span>Connected as <span className="font-mono text-[var(--foreground)]">{session.kiteUserId}</span> until {sessionEnd.format(session.expiresAt)} IST</span>
            <button type="submit" className="min-h-9 rounded-md border border-[var(--border-strong)] px-3 text-[var(--foreground)] hover:bg-[var(--card-raised)]">Disconnect</button>
          </form>
        )}
      </div>

      <ZerodhaNotice code={(await searchParams).zerodha} />
      {session ? <ZerodhaCharts /> : <ConnectZerodha next="/markets" />}

      <p className="max-w-3xl text-xs leading-6 text-[var(--muted)]">Prices come from your Zerodha account through Kite Connect and are shown only to you. Zerodha&apos;s terms don&apos;t allow Kite data on pages other people see, so trader evaluations will chart a licensed exchange feed. Charts by TradingView Lightweight Charts.</p>
    </div>
  );
}
