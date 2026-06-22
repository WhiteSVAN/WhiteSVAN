import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";

/** Centered card shell for the sign-in / sign-up screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <span className="text-xl font-semibold tracking-[0.18em] text-zinc-100">
            <SvanLogo />
          </span>
        </Link>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-8 shadow-sm">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-400">
          Verified quant &amp; trader network. Research software only.
        </p>
      </div>
    </div>
  );
}
