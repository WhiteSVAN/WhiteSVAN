import Link from "next/link";

/** Centered card shell for the sign-in / sign-up screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <span className="text-xl font-semibold tracking-tight text-slate-900">
            SVAN<span className="text-blue-700"> Trust OS</span>
          </span>
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Reporting &amp; analytics software. Not investment advice.
        </p>
      </div>
    </div>
  );
}
