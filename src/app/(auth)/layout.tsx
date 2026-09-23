import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";

/** Centered card shell for the sign-in / sign-up screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="terminal-grid flex min-h-full flex-1 items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <span className="text-2xl font-semibold text-zinc-100">
            <SvanLogo />
          </span>
        </Link>
        <div className="terminal-card relative overflow-hidden p-7 sm:p-9">
          <div className="mb-7 flex items-center justify-between border-b border-[#2d382f] pb-4 font-mono text-[9px] uppercase tracking-wider text-[#819083]">
            <span className="flex items-center gap-2"><i className="terminal-dot" /> Secure access</span>
            <span>TrustSVAN / auth</span>
          </div>
          {children}
        </div>
        <p className="mt-6 text-center font-mono text-[9px] uppercase tracking-wider text-zinc-400">
          Read-only by design / research software only
        </p>
      </div>
    </div>
  );
}
