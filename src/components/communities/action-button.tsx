"use client";

/**
 * A one-button form that calls a server action with hidden fields and shows
 * the action's message inline. The server action re-checks the session and
 * the caller's permissions — the hidden fields are just identifiers.
 */
import { useState, useTransition } from "react";
import type { CommunityActionResult } from "@/lib/communities";

const VARIANTS = {
  primary:
    "bg-zinc-100 text-zinc-950 hover:bg-white border border-transparent font-medium",
  secondary: "border border-zinc-700 text-zinc-300 hover:border-zinc-400 hover:text-white",
  danger: "border border-red-400/30 text-red-300 hover:border-red-400 hover:text-white",
} as const;

export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  confirmText,
  variant = "secondary",
  size = "md",
}: {
  action: (formData: FormData) => Promise<CommunityActionResult | void>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  confirmText?: string;
  variant?: keyof typeof VARIANTS;
  size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const pad = size === "sm" ? "min-h-8 px-2.5 text-[11px]" : "min-h-10 px-4 text-sm";

  return (
    <form
      className="inline-flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const data = new FormData(event.currentTarget);
        start(async () => {
          const r = await action(data);
          if (!r) setMessage(null);
          else if (!r.ok) setMessage({ text: r.error, error: true });
          else setMessage(r.message ? { text: r.message, error: false } : null);
        });
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center justify-center rounded-md transition disabled:opacity-60 ${pad} ${VARIANTS[variant]}`}
      >
        {pending ? (pendingLabel ?? "Working…") : label}
      </button>
      {message && (
        <span className={`text-xs ${message.error ? "text-zinc-300" : "text-[#dff5c4]"}`} role={message.error ? "alert" : "status"}>
          {message.text}
        </span>
      )}
    </form>
  );
}
