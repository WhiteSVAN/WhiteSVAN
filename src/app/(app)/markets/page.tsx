import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZerodhaCharts } from "@/components/markets/zerodha-charts";
import { requireUser } from "@/lib/auth/dal";
import { SITE_URL } from "@/lib/site";
import { currentKiteSession } from "@/lib/zerodha/access";
import { isKiteOwner, kiteConfig } from "@/lib/zerodha/config";

export const metadata: Metadata = { title: "Zerodha charts · WhiteSVAN", robots: { index: false } };

const NOTICES: Record<string, { text: string; tone: "ok" | "error" }> = {
  connected: { text: "Zerodha connected. Kite ends every session at 6 AM IST, so you'll log in again each trading day.", tone: "ok" },
  disconnected: { text: "Zerodha disconnected.", tone: "ok" },
  ended: { text: "Your Zerodha session ended. Kite logs everyone out at 6 AM IST, so log in again to keep charting.", tone: "error" },
  cancelled: { text: "The Zerodha login was cancelled.", tone: "error" },
  expired: { text: "That Zerodha login took too long or started in another browser. Try again.", tone: "error" },
  failed: { text: "Zerodha didn't accept the login. Check KITE_API_KEY and KITE_API_SECRET, and the redirect URL in the Kite developer console.", tone: "error" },
};

const sessionEnd = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Charts on the firm's own Zerodha account. A 404 for everyone not in KITE_OWNER_EMAILS. */
export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ zerodha?: string }> }) {
  const user = await requireUser();
  const config = kiteConfig();
  if (!isKiteOwner(config, user.email)) notFound();
  const session = await currentKiteSession({ userId: user.id, config });
  const notice = NOTICES[(await searchParams).zerodha ?? ""];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="terminal-label">Firm tools</p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Zerodha charts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">NIFTY, BANK NIFTY and SENSEX: the index, futures and options, with live prices and market depth from the firm&apos;s Zerodha account.</p>
        </div>
        {session && (
          <form action="/api/zerodha/logout" method="post" className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
            <span>Connected as <span className="font-mono text-[var(--foreground)]">{session.kiteUserId}</span> until {sessionEnd.format(session.expiresAt)} IST</span>
            <button type="submit" className="min-h-9 rounded-md border border-[var(--border-strong)] px-3 text-[var(--foreground)] hover:bg-[var(--card-raised)]">Disconnect</button>
          </form>
        )}
      </div>

      {notice && (
        <p role="status" className={`rounded-lg border p-4 text-sm ${notice.tone === "ok" ? "border-[var(--primary)]/40 text-[var(--primary)]" : "border-[var(--danger)]/40 text-[var(--danger)]"}`}>{notice.text}</p>
      )}

      {session ? <ZerodhaCharts /> : (
        <section className="terminal-card grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_.9fr]" aria-labelledby="connect-title">
          <div>
            <h2 id="connect-title" className="text-2xl font-medium tracking-tight">Connect the firm&apos;s Zerodha account</h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">Log in with Zerodha to load candles, live prices and five-level depth through Kite Connect. Kite accepts only the client ID registered on the firm&apos;s Kite Connect app, and ends every session at 6 AM IST.</p>
            {/* A route handler redirect, so a plain link rather than a prefetching <Link>. */}
            <a href="/api/zerodha/login" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Log in with Zerodha</a>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-5 text-xs leading-6 text-[var(--muted)]">
            <p className="terminal-label">Setup</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4">
              <li>Create a Kite Connect app (₹500 a month) on the firm&apos;s Zerodha client ID at developers.kite.trade.</li>
              <li>Set its redirect URL to<code className="mt-1 block break-all font-mono text-[var(--foreground)]">{SITE_URL}/api/zerodha/callback</code></li>
              <li>Add KITE_API_KEY, KITE_API_SECRET and KITE_OWNER_EMAILS to the environment and redeploy.</li>
            </ol>
          </div>
        </section>
      )}

      <p className="max-w-3xl text-xs leading-6 text-[var(--muted)]">Prices come from your Zerodha account through Kite Connect and are shown only to you. Zerodha&apos;s terms don&apos;t allow Kite data on pages other people see, so trader evaluations will chart a licensed exchange feed. Charts by TradingView Lightweight Charts.</p>
    </div>
  );
}
