import type { Metadata } from "next";
import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceNav } from "@/components/workspace-nav";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Admin · WhiteSVAN", robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/traders", label: "Traders" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/trades", label: "Trades" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

/**
 * The admin portal (read-only): every customer's profile and billing, every trader's accounts, risk
 * and quant performance, and the audit of every fill, order, breach and pass. Admins only
 * (requireAdmin: User.isAdmin, granted from the command line). Each page checks again: layouts
 * don't re-run on every client navigation.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-8 md:flex-row md:items-center md:gap-8">
          <Link href="/admin" className="flex items-center gap-2.5 self-start text-xl md:self-auto">
            <SvanLogo />
            <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted)]">Admin</span>
          </Link>
          <div className="flex w-full min-w-0 items-center gap-4 md:flex-1">
            <WorkspaceNav items={NAV.map((item) => ({ ...item }))} exact="/admin" />
            <ThemeToggle className="h-9 w-9" />
            <Link href="/dashboard" className="hidden shrink-0 text-xs text-[var(--muted)] hover:text-[var(--foreground)] sm:block" title={admin.email ?? undefined}>My accounts</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
