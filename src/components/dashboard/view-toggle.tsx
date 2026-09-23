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
    <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
      {VIEWS.map((v) => (
        <button
          key={v.k}
          type="button"
          onClick={() => set(v.k)}
          className={`rounded-md px-3 py-1 transition ${
            view === v.k ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
