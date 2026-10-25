import { PRICES_OFFLINE } from "@/lib/zerodha/connection";

/** The price-feed login card, for owners; `next` is where to land after logging in. */
export function ConnectZerodha({ next }: { next: string }) {
  return (
    <section className="terminal-card p-6 sm:p-8" aria-labelledby="connect-title">
      <h2 id="connect-title" className="text-2xl font-medium tracking-tight">Connect live prices</h2>
      <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">Log in to the firm&apos;s broker account to turn on charts, live prices and depth for every signed-in user. The connection ends at 6 AM IST each day.</p>
      {/* A route handler redirect, so a plain link rather than a prefetching <Link>. */}
      <a href={`/api/zerodha/login?${new URLSearchParams({ next })}`} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]">Connect live prices</a>
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
