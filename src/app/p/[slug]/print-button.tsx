"use client";

/** Triggers the browser print dialog (Save as PDF). Hidden in the printout. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Print / Save PDF
    </button>
  );
}
