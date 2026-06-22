import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { AccountMenu } from "./account-menu";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/network", label: "Network" },
  { href: "/explore", label: "Discover" },
];

/**
 * Authenticated app shell. `requireUser()` redirects to /login when there is no
 * session. Pages still guard their own data (layouts don't re-run on every
 * client navigation; see the Next.js auth guide).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/dashboard"
            className="text-base font-semibold tracking-[0.18em] text-slate-100"
          >
            QUANTI<span className="text-cyan-300">DIVE</span>
          </Link>
          <nav className="flex items-center justify-end gap-x-5 gap-y-2 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-slate-400 hover:text-white">
                {item.label}
              </Link>
            ))}
            <AccountMenu label={user.name ?? user.email ?? "Account"} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
