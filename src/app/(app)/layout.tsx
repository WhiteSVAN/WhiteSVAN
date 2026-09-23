import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { requireUser } from "@/lib/auth/dal";
import { AccountMenu } from "./account-menu";

const NAV = [
  { href: "/dashboard", label: "Record" },
  { href: "/network", label: "Network" },
];

/**
 * Authenticated app shell. `requireUser()` redirects to /login when there is no
 * session. Pages still guard their own data (layouts don't re-run on every
 * client navigation; see the Next.js auth guide).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="border-b border-[#202a23] bg-[#111711] font-mono text-[9px] uppercase tracking-[0.08em] text-[#8f9d8e]">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 sm:px-8">
          <span className="flex items-center gap-2"><i className="terminal-dot" /> Operator workspace</span>
          <span className="hidden sm:block">Authenticated / private by default</span>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link
            href="/dashboard"
            className="self-start text-xl font-semibold text-zinc-100"
          >
            <SvanLogo />
          </Link>
          <nav className="flex w-full items-center gap-x-6 gap-y-2 overflow-x-auto pb-1 text-xs sm:w-auto sm:justify-end sm:overflow-visible sm:pb-0">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 font-medium text-zinc-400 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <AccountMenu label={user.name ?? user.email ?? "Account"} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
