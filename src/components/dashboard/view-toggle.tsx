"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const VIEWS = [
  { k: "client", label: "Research view" },
  { k: "trader", label: "Trader metrics" },
];

/** Switches the dashboard between research and trader-metrics views. */
export function ViewToggle({ view }: { view: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(v: string) {
    const next = new URLSearchParams(params.toString());
    next.set("view", v);
    next.delete("imported");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
      {VIEWS.map((v) => (
        <button
          key={v.k}
          type="button"
          onClick={() => set(v.k)}
          className={`rounded-md px-3 py-1 transition ${
            view === v.k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
