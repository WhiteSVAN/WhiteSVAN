/**
 * Presentational form primitives shared across screens. No hooks here, so these
 * are safe to import from both Server and Client Components.
 */
export const labelClass = "block text-sm font-medium text-[var(--foreground)]";

export const inputClass =
  "mt-1.5 block min-h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input)] px-3.5 py-2.5 text-sm " +
  "text-[var(--foreground)] placeholder:text-[var(--faint)] transition focus:outline-none";

export const btnPrimary =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm " +
  "font-medium text-[var(--ink-foreground)] transition hover:bg-[var(--ink-hover)] disabled:cursor-not-allowed disabled:opacity-60";

/** Shows the first validation message for a field, if any. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1.5 text-xs text-[var(--danger)]">{messages[0]}</p>;
}

/** Red banner for a top-level form error. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-[var(--danger)]/40 px-3.5 py-2.5 text-sm text-[var(--danger)]" role="alert">
      {message}
    </div>
  );
}
