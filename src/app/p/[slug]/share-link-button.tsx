"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/**
 * Copies the profile's canonical share link (always the overview, never the
 * current tab/version query). Falls back to the native share sheet, then to
 * selecting the URL, when the clipboard API is unavailable.
 */
export function ShareLinkButton({ path }: { path: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
      return;
    } catch {
      // fall through
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to manual copy
      }
    }
    setManualUrl(url);
    setStatus("manual");
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-400 hover:text-white"
      >
        {status === "copied" ? (
          <Check className="h-3.5 w-3.5 text-[#baf277]" aria-hidden="true" />
        ) : (
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {status === "copied" ? "Link copied" : "Copy share link"}
      </button>
      {status === "manual" && manualUrl && (
        <input
          readOnly
          value={manualUrl}
          aria-label="Profile link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 max-w-full flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-300"
        />
      )}
      <span className="sr-only" aria-live="polite">
        {status === "copied" ? "Profile link copied to clipboard" : ""}
      </span>
    </div>
  );
}
