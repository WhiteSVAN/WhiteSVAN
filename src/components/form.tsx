/**
 * Presentational form primitives shared across screens. No hooks here, so these
 * are safe to import from both Server and Client Components.
 */
export const labelClass = "block text-sm font-medium text-slate-300";

export const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm " +
  "text-slate-100 placeholder-slate-500 shadow-sm focus:border-cyan-500 focus:outline-none " +
  "focus:ring-1 focus:ring-cyan-500";

export const btnPrimary =
  "flex w-full items-center justify-center rounded-lg bg-cyan-600 px-4 py-2 text-sm " +
  "font-medium text-white shadow-sm transition hover:bg-cyan-500 focus:outline-none " +
  "focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60";

/** Shows the first validation message for a field, if any. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-400">{messages[0]}</p>;
}

/** Red banner for a top-level form error. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-900/60 bg-red-950/60 px-3 py-2 text-sm text-red-200" role="alert">
      {message}
    </div>
  );
}
