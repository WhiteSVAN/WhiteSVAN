"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { setPortalVisibility } from "@/app/(app)/account-settings";

/** Research profile link + public/private toggle + copy, shown in the dashboard header. */
export function PortalShare({ slug, isPublic }: { slug: string; isPublic: boolean }) {
  const [state, action, pending] = useActionState(setPortalVisibility, undefined);
  const live = state?.isPublic ?? isPublic;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
      <span>
        Research profile: <span className="font-mono text-slate-300">/p/{slug}</span>
      </span>
      <span
        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
          live ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {live ? "Public" : "Private"}
      </span>
      <form action={action}>
        <input type="hidden" name="isPublic" value={live ? "false" : "true"} />
        <button
          type="submit"
          disabled={pending}
          className="text-blue-700 hover:text-blue-800 disabled:opacity-60"
        >
          {live ? "Make private" : "Make public"}
        </button>
      </form>
      {live && (
        <>
          <span className="text-slate-600">/</span>
          <button type="button" onClick={copy} className="text-blue-700 hover:text-blue-800">
            {copied ? "Copied!" : "Copy link"}
          </button>
          <Link href={`/p/${slug}`} target="_blank" className="text-cyan-300 hover:text-cyan-100">
            Open
          </Link>
        </>
      )}
    </div>
  );
}
