import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { requireUser } from "@/lib/auth/dal";
import { unreadCount } from "@/lib/notify";
import { isKiteOwner, kiteConfig } from "@/lib/zerodha/config";
import { WorkspaceNav } from "@/components/workspace-nav";
import { AccountMenu } from "./account-menu";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "My accounts" },
  { href: "/track", label: "Track record" },
  { href: "/evaluations", label: "Evaluations" },
  { href: "/payouts", label: "Payouts" },
  { href: "/academy", label: "Academy" },
  { href: "/help", label: "Help" },
];

const TRADER_TOOLS = [
  { href: "/journal", label: "Trading journal" },
  { href: "/upload", label: "Import data" },
  { href: "/analytics", label: "Profile analytics" },
  { href: "/reports", label: "Performance briefs" },
  { href: "/feed", label: "Feed" },
  { href: "/explore", label: "Traders" },
  { href: "/communities", label: "Communities" },
];

const CLIENT_TOOLS = [
  { href: "/journal", label: "Research workspace" },
  { href: "/explore", label: "Traders" },
  { href: "/feed", label: "Feed" },
  { href: "/communities", label: "Communities" },
];

/**
 * Authenticated app shell. `requireUser()` redirects to /login when there is no
 * session. Pages still guard their own data (layouts don't re-run on every
 * client navigation; see the Next.js auth guide).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const roleTools = user.role === "CLIENT" ? CLIENT_TOOLS : TRADER_TOOLS;
  // The firm's own Zerodha charts, for the accounts in KITE_OWNER_EMAILS only.
  const tools = isKiteOwner(kiteConfig(), user.email) ? [...roleTools, { href: "/markets", label: "Zerodha charts" }] : roleTools;
  const unread = await unreadCount(user.id);

  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#8f9d8e]">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 sm:px-8">
          <span className="flex items-center gap-2"><i className="terminal-dot" /> WhiteSVAN / Trader dashboard</span>
          <span className="hidden sm:block">Evaluations launching soon</span>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-8 xl:flex-row xl:items-center xl:gap-8">
          <Link
            href="/dashboard"
            className="self-start text-xl font-semibold text-zinc-100"
          >
            <SvanLogo />
          </Link>
          <div className="flex min-w-0 w-full items-center gap-4 xl:flex-1">
            <WorkspaceNav items={PRIMARY_NAV} tools={tools} unread={unread} />
            <AccountMenu label={user.name ?? user.email ?? "Account"} role={user.role} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
