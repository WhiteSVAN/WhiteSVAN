"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Read-only link field with a copy button (falls back to selecting the text). */
export function CopyLink({ id, label, value }: { id: string; label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const input = document.getElementById(id) as HTMLInputElement | null;
      input?.select();
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-400">
        {label}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-zinc-100 px-4 text-sm font-medium text-zinc-950 hover:bg-white"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
        </button>
      </div>
    </div>
  );
}
