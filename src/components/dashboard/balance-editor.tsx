"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setStartingBalance } from "@/app/(app)/account-settings";
import { formatMoney } from "@/lib/format";

/**
 * Starting-investment control. Compact one-liner once set; a clean inline form
 * when unset. Equity, growth rate, and drawdown % are all relative to this, so
 * empty saves are blocked and the page refreshes on success.
 */
export function BalanceEditor({
  accountId,
  startingBalance,
}: {
  accountId: string;
  startingBalance: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setStartingBalance, undefined);
  const [manualEditing, setManualEditing] = useState(false);
  const [value, setValue] = useState(startingBalance ? String(startingBalance) : "");

  // Pull fresh server-computed metrics once the save lands.
  useEffect(() => {
    if (state?.saved) router.refresh();
  }, [state, router]);

  const showForm = startingBalance === 0 || manualEditing;

  if (!showForm) {
    return (
      <p className="text-sm text-zinc-500">
        Starting investment{" "}
        <span className="font-medium text-zinc-700">{formatMoney(startingBalance)}</span>
        <button
          type="button"
          onClick={() => setManualEditing(true)}
          className="ml-2 text-zinc-200 hover:text-zinc-100"
        >
          Edit
        </button>
      </p>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => setManualEditing(false)}
      className="terminal-card flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
    >
      <input type="hidden" name="accountId" value={accountId} />
      <label htmlFor="startingBalance" className="font-medium text-zinc-600">
        Starting investment
      </label>
      <div className="flex items-center">
        <span className="text-zinc-400">$</span>
        <input
          id="startingBalance"
          name="startingBalance"
          type="number"
          min="0"
          step="100"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 20000"
          autoFocus
          className="w-32 rounded border border-zinc-300 px-2 py-1 text-zinc-900 focus:border-zinc-400 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !value}
        className="rounded bg-zinc-100 px-3 py-1 font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set"}
      </button>
      {startingBalance > 0 && (
        <button
          type="button"
          onClick={() => setManualEditing(false)}
          className="text-zinc-400 hover:text-zinc-600"
        >
          Cancel
        </button>
      )}
      <span className="text-zinc-400">— used for growth rate &amp; drawdown.</span>
      {state?.error && <span className="text-zinc-300">{state.error}</span>}
    </form>
  );
}
