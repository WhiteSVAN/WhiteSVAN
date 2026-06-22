import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { logout } from "./actions";

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
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
            <Link href="/dashboard" className="text-slate-400 hover:text-white">
              Dashboard
            </Link>
            <Link href="/network" className="text-slate-400 hover:text-white">
              Network
            </Link>
            <Link href="/upload" className="text-slate-400 hover:text-white">
              Import
            </Link>
            <Link href="/reports" className="text-slate-400 hover:text-white">
              Briefs
            </Link>
            <Link href="/settings" className="text-slate-400 hover:text-white">
              Settings
            </Link>
            <Link href="/explore" className="text-slate-400 hover:text-white">
              Directory
            </Link>
            <span className="hidden text-slate-500 sm:inline">{user.name ?? user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 transition hover:border-cyan-400 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
