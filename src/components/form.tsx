/**
 * Presentational form primitives shared across screens. No hooks here, so these
 * are safe to import from both Server and Client Components.
 */
export const labelClass = "block text-sm font-medium text-slate-700";

export const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm " +
  "text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-600 focus:outline-none " +
  "focus:ring-1 focus:ring-blue-600";

export const btnPrimary =
  "flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm " +
  "font-medium text-white shadow-sm transition hover:bg-blue-800 focus:outline-none " +
  "focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

/** Shows the first validation message for a field, if any. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{messages[0]}</p>;
}

/** Red banner for a top-level form error. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {message}
    </div>
  );
}
