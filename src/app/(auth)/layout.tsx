import Link from "next/link";

/** Centered card shell for the sign-in / sign-up screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <span className="text-xl font-semibold tracking-[0.18em] text-slate-100">
            QUANTI<span className="text-cyan-300">DIVE</span>
          </span>
        </Link>
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-8 shadow-sm">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Verified quant &amp; trader network. Research software only.
        </p>
      </div>
    </div>
  );
}
