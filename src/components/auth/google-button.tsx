import { signInWithGoogle } from "@/app/(auth)/actions";

/**
 * "Continue with Google" — a plain server-action form so it works without JS.
 * Rendered only when Google OAuth is configured (see `googleEnabled`).
 */
export function GoogleButton({ role, referral }: { role?: string; referral?: string }) {
  return (
    <form action={signInWithGoogle}>
      {role && <input type="hidden" name="role" value={role} />}
      {referral && <input type="hidden" name="ref" value={referral} />}
      <button
        type="submit"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-400 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.64 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.54 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c6.93 0 9.52-4.86 9.52-9.37 0-.63-.07-1.1-.17-1.58Z" />
        </svg>
        Continue with Google
      </button>
    </form>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
      <span className="h-px flex-1 bg-zinc-800" /> or <span className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}
