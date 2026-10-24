import { SITE_URL } from "@/lib/site";
import { PRICES_OFFLINE } from "@/lib/zerodha/connection";

/** The Kite login card for the firm's account, for owners; `next` is where to land after Zerodha's login. */
export function ConnectZerodha({ next }: { next: string }) {
  return (
    <section className="terminal-card grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_.9fr]" aria-labelledby="connect-title">
      <div>
        <h2 id="connect-title" className="text-2xl font-medium tracking-tight">Connect the firm&apos;s Zerodha account</h2>
        <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">Log in with Zerodha to load candles, live prices and five-level depth through Kite Connect for every signed-in user. Kite accepts only the client ID registered on the firm&apos;s Kite Connect app, and ends every session at 6 AM IST.</p>
        {/* A route handler redirect, so a plain link rather than a prefetching <Link>. */}
        <a href={`/api/zerodha/login?${new URLSearchParams({ next })}`} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Log in with Zerodha</a>
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
  );
}

/** What everyone else sees while the shared login is down: only an owner can reconnect it. */
export function PricesOffline() {
  return (
    <section className="terminal-card px-6 py-12 text-center">
      <h2 className="text-xl font-medium tracking-tight">Live prices are offline</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{PRICES_OFFLINE}</p>
    </section>
  );
}
