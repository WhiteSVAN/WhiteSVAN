import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { requireUser } from "@/lib/auth/dal";
import { AccountMenu } from "./account-menu";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/network", label: "Verified traders" },
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
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard"
            className="self-start text-base font-semibold tracking-[0.14em] text-zinc-100 sm:tracking-[0.18em]"
          >
            <SvanLogo />
          </Link>
          <nav className="flex w-full items-center gap-x-4 gap-y-2 overflow-x-auto pb-1 text-sm sm:w-auto sm:justify-end sm:overflow-visible sm:pb-0">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 text-zinc-400 hover:text-white"
              >
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
