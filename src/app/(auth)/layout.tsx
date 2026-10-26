import Link from "next/link";
import { SvanLogo } from "@/components/svan-logo";
import { ThemeToggle } from "@/components/theme-toggle";

/** Centered card shell for the sign-in / sign-up screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center bg-[var(--background)] px-4 py-12">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center text-2xl">
          <SvanLogo />
        </Link>
        <div className="terminal-card relative overflow-hidden p-7 sm:p-9">
          {children}
        </div>
      </div>
    </div>
  );
}
