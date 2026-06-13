"use client";

import { useRouter } from "next/navigation";

/** Goes back to the previous page the user came from. */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-slate-500 hover:text-slate-800"
    >
      ← Back
    </button>
  );
}
