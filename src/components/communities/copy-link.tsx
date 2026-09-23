"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Shows a site-relative path and copies the absolute URL (built from the current origin). */
export function CopyLink({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <code className="min-w-0 break-all rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-300">
        {path}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 text-[11px] text-zinc-300 hover:border-zinc-400 hover:text-white"
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}
