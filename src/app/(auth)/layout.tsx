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
          {children}
        </div>
      </div>
    </div>
  );
}
