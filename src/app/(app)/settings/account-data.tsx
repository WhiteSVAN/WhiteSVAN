"use client";

import { type FormEvent } from "react";
import { clearAccountTrades, deleteAccount, clearAllData } from "./actions";

interface AccountRow {
  id: string;
  accountName: string;
  broker: string | null;
  tradeCount: number;
}

/** Block the (destructive) submit unless the user confirms. */
function confirmSubmit(message: string) {
  return (e: FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) e.preventDefault();
  };
}

export function AccountData({ accounts }: { accounts: AccountRow[] }) {
  const totalTrades = accounts.reduce((n, a) => n + a.tradeCount, 0);

  return (
    <div className="space-y-4">
      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500">No trading accounts yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-800">{a.accountName}</p>
                <p className="text-xs text-zinc-400">
                  {a.broker ? `${a.broker} · ` : ""}
                  {a.tradeCount} {a.tradeCount === 1 ? "trade" : "trades"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <form
                  action={clearAccountTrades}
                  onSubmit={confirmSubmit(
                    `Clear all ${a.tradeCount} loaded trades from “${a.accountName}”? ` +
                      `The account is kept. This can’t be undone.`,
                  )}
                >
                  <input type="hidden" name="accountId" value={a.id} />
                  <button
                    type="submit"
                    disabled={a.tradeCount === 0}
                    className="text-xs font-medium text-zinc-400 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear trades
                  </button>
                </form>
                <form
                  action={deleteAccount}
                  onSubmit={confirmSubmit(
                    `Delete the account “${a.accountName}” and all its trades & reports? ` +
                      `Uploaded statements are kept. This can’t be undone.`,
                  )}
                >
                  <input type="hidden" name="accountId" value={a.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-red-400 hover:text-red-300"
                  >
                    Delete account
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        action={clearAllData}
        onSubmit={confirmSubmit(
          "Clear ALL loaded trades across every account? " +
            "Accounts, reports, and evidence are kept. This can’t be undone.",
        )}
      >
        <button
          type="submit"
          disabled={totalTrades === 0}
          className="rounded-lg border border-red-400/30 bg-zinc-950/80 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear all trade data
        </button>
      </form>
    </div>
  );
}
