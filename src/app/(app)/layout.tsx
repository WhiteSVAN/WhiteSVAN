import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { logout } from "./actions";

/**
 * Authenticated app shell. `requireUser()` redirects to /login when there is no
 * session — pages still guard their own data (layouts don't re-run on every
 * client navigation; see the Next.js auth guide).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/dashboard"
            className="text-base font-semibold tracking-tight text-slate-900"
          >
            Trust<span className="text-blue-700">SVAN</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="/upload" className="text-slate-600 hover:text-slate-900">
              Import
            </Link>
            <Link href="/reports" className="text-slate-600 hover:text-slate-900">
              Reports
            </Link>
            <Link href="/settings" className="text-slate-600 hover:text-slate-900">
              Settings
            </Link>
            <span className="hidden text-slate-500 sm:inline">{user.name ?? user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-slate-200 px-3 py-1 text-slate-600 transition hover:bg-slate-50"
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
