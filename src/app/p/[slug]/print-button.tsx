"use client";

import { Printer } from "lucide-react";

/** Triggers the browser print dialog (Save as PDF). Hidden in the printout. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-400 hover:text-white print:hidden"
    >
      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
      Print / Save PDF
    </button>
  );
}
