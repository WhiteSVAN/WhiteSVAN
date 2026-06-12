"use client";

import { useActionState } from "react";
import { createAccount } from "./actions";
import { btnPrimary, FieldError, inputClass, labelClass } from "@/components/form";

export function CreateAccountForm() {
  const [state, action, pending] = useActionState(createAccount, undefined);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-medium text-slate-800">Create a trading account</h2>
      <p className="mt-1 text-sm text-slate-500">
        First, add the account these trades belong to. You can add more later.
      </p>

      <form action={action} className="mt-4 space-y-4">
        <div>
          <label htmlFor="accountName" className={labelClass}>
            Account name
          </label>
          <input
            id="accountName"
            name="accountName"
            required
            className={inputClass}
            placeholder="Topstep 150k"
          />
          <FieldError messages={state?.errors?.accountName} />
        </div>

        <div>
          <label htmlFor="broker" className={labelClass}>
            Broker <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="broker"
            name="broker"
            className={inputClass}
            placeholder="Interactive Brokers, Tradovate, Topstep…"
          />
        </div>

        <div>
          <label htmlFor="startingBalance" className={labelClass}>
            Starting balance <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="startingBalance"
            name="startingBalance"
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            placeholder="150000"
          />
          <p className="mt-1 text-xs text-slate-400">Used for return % and drawdown %.</p>
        </div>

        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
