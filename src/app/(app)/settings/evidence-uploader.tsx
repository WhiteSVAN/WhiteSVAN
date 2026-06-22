"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadEvidence } from "./actions";
import { inputClass, labelClass } from "@/components/form";

const KINDS = [
  { v: "STATEMENT", label: "Broker statement (raises Proof Level)" },
  { v: "TAX_RETURN", label: "Tax return / official tax record (raises Proof Level 4)" },
  { v: "PAYOUT", label: "Payout proof" },
  { v: "EXPORT", label: "Source export" },
  { v: "OTHER", label: "Other" },
];

export function EvidenceUploader({ accounts }: { accounts: { id: string; accountName: string }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadEvidence, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.saved) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="file" className={labelClass}>
          File <span className="text-slate-400">(PDF, image, source export - max 10 MB)</span>
        </label>
        <input
          id="file"
          type="file"
          name="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
          required
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      <div>
        <label htmlFor="kind" className={labelClass}>
          Type
        </label>
        <select id="kind" name="kind" defaultValue="STATEMENT" className={inputClass}>
          {KINDS.map((k) => (
            <option key={k.v} value={k.v}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      {accounts.length > 0 && (
        <div>
          <label htmlFor="accountId" className={labelClass}>
            Account <span className="text-slate-400">(optional)</span>
          </label>
          <select id="accountId" name="accountId" defaultValue="" className={inputClass}>
            <option value="">— none —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountName}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <label htmlFor="label" className={labelClass}>
          Label <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="label"
          name="label"
          placeholder="e.g. May 2026 IBKR statement"
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
