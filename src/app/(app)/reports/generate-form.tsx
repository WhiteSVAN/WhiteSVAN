"use client";

import { useActionState, useState } from "react";
import { generateReport } from "./actions";
import { btnPrimary, FormError, inputClass, labelClass } from "@/components/form";

interface AccountOption {
  id: string;
  accountName: string;
  periods: string[]; // "YYYY-MM", newest first
}

function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function GenerateReportForm({ accounts }: { accounts: AccountOption[] }) {
  const [state, action, pending] = useActionState(generateReport, undefined);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const [period, setPeriod] = useState(account?.periods[0] ?? "");

  const periods = account?.periods ?? [];

  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.message} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="account" className={labelClass}>
            Account
          </label>
          <select
            id="account"
            name="accountId"
            value={accountId}
            onChange={(e) => {
              const next = accounts.find((a) => a.id === e.target.value);
              setAccountId(e.target.value);
              setPeriod(next?.periods[0] ?? "");
            }}
            className={inputClass}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="period" className={labelClass}>
            Month
          </label>
          <select
            id="period"
            name="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={inputClass}
            disabled={periods.length === 0}
          >
            {periods.length === 0 ? (
              <option value="">No imported months</option>
            ) : (
              periods.map((p) => (
                <option key={p} value={p}>
                  {periodLabel(p)}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <button type="submit" disabled={pending || !period} className={`${btnPrimary} sm:w-auto sm:px-6`}>
        {pending ? "Generating..." : "Generate brief"}
      </button>
    </form>
  );
}
