"use client";

import { useActionState } from "react";
import { setStartingBalance } from "@/app/(app)/account-settings";

/** Inline starting-balance editor. Highlights when unset, since the equity
 *  curve and drawdown % depend on it. */
export function BalanceEditor({
  accountId,
  startingBalance,
}: {
  accountId: string;
  startingBalance: number;
}) {
  const [state, action, pending] = useActionState(setStartingBalance, undefined);
  const unset = startingBalance === 0;

  return (
    <form
      action={action}
      className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        unset ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <label htmlFor="startingBalance" className="font-medium text-slate-600">
        Starting balance
      </label>
      <div className="flex items-center">
        <span className="text-slate-400">$</span>
        <input
          id="startingBalance"
          name="startingBalance"
          type="number"
          step="0.01"
          min="0"
          defaultValue={startingBalance || ""}
          placeholder="20000"
          className="w-28 rounded border border-slate-300 px-2 py-1 text-slate-900 focus:border-blue-600 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-2.5 py-1 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.saved && <span className="text-emerald-600">Saved</span>}
      {state?.error && <span className="text-red-600">{state.error}</span>}
      {unset && !state?.saved && (
        <span className="text-amber-700">
          Set this so equity and drawdown reflect your real account size.
        </span>
      )}
    </form>
  );
}
