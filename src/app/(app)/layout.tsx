import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { requireUser } from "@/lib/auth/dal";
import { DEMO_CHECKOUT } from "@/lib/checkout/demo";
import { kiteConfig } from "@/lib/zerodha/config";
import { WorkspaceNav } from "@/components/workspace-nav";
import { AccountMenu } from "./account-menu";

/**
 * Authenticated app shell: My accounts, Trade (once live prices are set up) and Journal, with
 * Payouts, Academy, Help, Settings and sign-out in the account menu. `requireUser()` redirects to /login
 * when there is no session; pages still guard their own data (layouts don't re-run on every
 * client navigation; see the Next.js auth guide).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = [
    { href: "/dashboard", label: "My accounts" },
    ...(kiteConfig() ? [{ href: "/markets", label: "Trade" }] : []),
    { href: "/journal", label: "Journal" },
  ];

  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
      {DEMO_CHECKOUT && <p className="border-b border-[var(--border)] bg-[#172216] px-4 py-2 text-center text-[11px] text-[#c7d7bd]">Demo mode: evaluations are bought with virtual credit.</p>}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-8 md:flex-row md:items-center md:gap-8">
          <Link href="/dashboard" className="self-start text-xl font-semibold text-zinc-100 md:self-auto">
            <SvanLogo />
          </Link>
          <div className="flex w-full min-w-0 items-center gap-4 md:flex-1">
            <WorkspaceNav items={nav} />
            <AccountMenu label={user.name ?? user.email ?? "Account"} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
