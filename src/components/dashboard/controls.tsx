"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const RANGES = [
  { k: "all", label: "All" },
  { k: "90d", label: "90D" },
  { k: "30d", label: "30D" },
  { k: "ytd", label: "YTD" },
];

interface AccountOpt {
  id: string;
  accountName: string;
}

/** Account selector + date-range presets. Drives the dashboard via query params. */
export function DashboardControls({
  accounts,
  accountId,
  range,
}: {
  accounts: AccountOpt[];
  accountId: string;
  range: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    next.delete("imported"); // drop stale import banner on interaction
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {accounts.length > 1 && (
        <select
          aria-label="Trading account"
          value={accountId}
          onChange={(e) => update("account", e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 shadow-sm focus:border-zinc-400 focus:outline-none"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.accountName}
            </option>
          ))}
        </select>
      )}
      <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
        {RANGES.map((r) => (
          <button
            key={r.k}
            type="button"
            aria-pressed={range === r.k}
            onClick={() => update("range", r.k)}
            className={`rounded-md px-3 py-1 transition ${
              range === r.k ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
