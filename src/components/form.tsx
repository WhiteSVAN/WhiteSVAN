/**
 * Presentational form primitives shared across screens. No hooks here, so these
 * are safe to import from both Server and Client Components.
 */
export const labelClass =
  "block font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-400";

export const inputClass =
  "mt-2 block min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm " +
  "text-zinc-100 placeholder-zinc-500 shadow-sm transition focus:border-zinc-400 focus:outline-none " +
  "focus:ring-1 focus:ring-zinc-400";

export const btnPrimary =
  "flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-100 px-4 py-2.5 text-sm " +
  "font-medium text-zinc-950 shadow-sm transition hover:bg-white focus:outline-none " +
  "focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60";

/** Shows the first validation message for a field, if any. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-zinc-300">{messages[0]}</p>;
}

/** Red banner for a top-level form error. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200" role="alert">
      {message}
    </div>
  );
}
