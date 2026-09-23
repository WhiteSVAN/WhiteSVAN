"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  GitCompareArrows,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

export interface DirectoryOperator {
  slug: string;
  displayName: string;
  strategy: string | null;
  instruments: string | null;
  headline: string | null;
  openToWork: boolean;
  proofLevel: number | null;
  returnPct: number | null;
  maxDrawdownPct: number | null;
  capitalBand?: string | null;
  trackRecord?: string | null;
  freshness?: string | null;
  isIllustrative?: boolean;
  href?: string;
}

const WATCHLIST_KEY = "trustsvan:watchlist:v2";
const WATCHLIST_EVENT = "trustsvan-watchlist-change";

function subscribeWatchlist(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(WATCHLIST_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(WATCHLIST_EVENT, onStoreChange);
  };
}

function getWatchlistSnapshot() {
  return localStorage.getItem(WATCHLIST_KEY) ?? "[]";
}

function parseWatchlist(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function returnPercent(value: number | null) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function drawdownPercent(value: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function sourceLabel(level: number | null) {
  if (level == null) return "No published record";
  if (level >= 5) return "Independently reviewed";
  if (level >= 4) return "Additional document attached";
  if (level >= 3) return "Statement attached";
  if (level >= 2) return "Imported history";
  return "Self-reported";
}

export function OperatorDirectory({ operators }: { operators: DirectoryOperator[] }) {
  const [search, setSearch] = useState("");
  const [proof, setProof] = useState("all");
  const [strategy, setStrategy] = useState("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const savedSnapshot = useSyncExternalStore(subscribeWatchlist, getWatchlistSnapshot, () => "[]");
  const saved = useMemo(() => parseWatchlist(savedSnapshot), [savedSnapshot]);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  useEffect(() => {
    if (!comparisonOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setComparisonOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [comparisonOpen]);

  const strategies = useMemo(
    () => [...new Set(operators.map((operator) => operator.strategy).filter(Boolean))] as string[],
    [operators],
  );

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    return operators
      .filter((operator) => {
        const text = `${operator.displayName} ${operator.strategy ?? ""} ${operator.instruments ?? ""} ${operator.headline ?? ""}`.toLowerCase();
        return (
          (!query || text.includes(query)) &&
          (proof === "all" || operator.proofLevel === Number(proof)) &&
          (strategy === "all" || operator.strategy === strategy) &&
          (!savedOnly || saved.includes(operator.slug))
        );
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [operators, proof, saved, savedOnly, search, strategy]);

  const compared = compare.map((slug) => operators.find((operator) => operator.slug === slug)).filter(Boolean) as DirectoryOperator[];

  function toggleSaved(slug: string) {
    const next = saved.includes(slug) ? saved.filter((item) => item !== slug) : [...saved, slug];
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(WATCHLIST_EVENT));
    } catch {
      // The directory remains usable without browser storage.
    }
  }

  function toggleCompare(slug: string) {
    setCompare((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length === 2) return [current[1], slug];
      return [...current, slug];
    });
  }

  function clearFilters() {
    setSearch("");
    setProof("all");
    setStrategy("all");
    setSavedOnly(false);
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[#2d382f] bg-[#101511] shadow-[0_28px_80px_rgba(0,0,0,.18)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2d382f] px-5 py-4">
          <div className="flex items-center gap-5 text-xs">
            <button type="button" onClick={() => setSavedOnly(false)} className={`pb-4 ${!savedOnly ? "-mb-[17px] border-b-2 border-[#baf277] text-[#e1e9dc]" : "text-[#849083] hover:text-[#c5d0c1]"}`}>
              All operators <span className="ml-1 font-mono text-[10px] text-[#9cad92]">{operators.length}</span>
            </button>
            <button type="button" onClick={() => setSavedOnly(true)} className={`flex items-center gap-1.5 pb-4 ${savedOnly ? "-mb-[17px] border-b-2 border-[#baf277] text-[#e1e9dc]" : "text-[#849083] hover:text-[#c5d0c1]"}`}>
              <Bookmark className="h-3.5 w-3.5" /> Watchlist <span className="font-mono text-[10px] text-[#9cad92]">{saved.length}</span>
            </button>
          </div>
          <span className="terminal-label flex items-center gap-2"><i className="terminal-dot" /> Published snapshots</span>
        </div>

        <div className="grid gap-3 border-b border-[#2d382f] p-4 lg:grid-cols-[1fr_auto_auto]">
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-[#344039] bg-[#0d1310] px-3">
            <Search className="h-4 w-4 shrink-0 text-[#839085]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 border-0 !bg-transparent p-0 text-sm outline-none !shadow-none"
              placeholder="Name, strategy, or instrument…"
              aria-label="Search operators"
            />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
          </label>
          <select value={proof} onChange={(event) => setProof(event.target.value)} aria-label="Record source" className="min-h-11 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-300">
            <option value="all">All record sources</option>
            <option value="5">Independently reviewed</option>
            <option value="4">Additional document attached</option>
            <option value="3">Statement attached</option>
            <option value="2">Imported history</option>
            <option value="1">Self-reported</option>
          </select>
          <select value={strategy} onChange={(event) => setStrategy(event.target.value)} aria-label="Strategy" className="min-h-11 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-300">
            <option value="all">All strategies</option>
            {strategies.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="grid gap-px bg-[#263029] md:grid-cols-2" aria-live="polite">
          {results.length ? results.map((operator) => (
            <article key={operator.slug} className="group flex min-h-[270px] flex-col bg-[#101511] p-5 transition hover:bg-[#141c16] sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#4d603c] bg-[#23321c] font-mono text-[10px] text-[#cce1b6]">{initials(operator.displayName)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={operator.href ?? `/p/${operator.slug}`} className="truncate text-base font-medium text-[#e8eee3] hover:text-[#baf277]">{operator.displayName}</Link>
                    {operator.isIllustrative && <span className="rounded border border-[#485342] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[#96a28e]">Example</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#849083]">{operator.headline || [operator.strategy, operator.instruments].filter(Boolean).join(" · ") || "Published operator"}</p>
                </div>
                <button type="button" onClick={() => toggleSaved(operator.slug)} aria-label={saved.includes(operator.slug) ? `Remove ${operator.displayName} from watchlist` : `Save ${operator.displayName} to watchlist`} className={`rounded-md p-2 text-[#7f8d7e] hover:bg-[#1c271d] hover:text-[#baf277] ${saved.includes(operator.slug) ? "text-[#baf277]" : ""}`}>
                  <Bookmark className="h-4 w-4" fill={saved.includes(operator.slug) ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {operator.proofLevel ? <span className="inline-flex items-center gap-1 rounded border border-[#57733a] bg-[#1a2418] px-2 py-1 text-[9px] text-[#bdd69e]"><ShieldCheck className="h-3 w-3" /> {sourceLabel(operator.proofLevel)}</span> : <span className="text-xs text-[#7d897f]">Unpublished</span>}
                {operator.openToWork && <i className="terminal-dot" title="Open to work" />}
                <span className="truncate text-[9px] text-[#738078]">{operator.strategy}</span>
              </div>
              <div className="mt-5 grid grid-cols-3 border-y border-[#2a352c] py-4">
                <DirectoryMetric label="Period return" value={returnPercent(operator.returnPct)} accent />
                <DirectoryMetric label="Max drawdown" value={drawdownPercent(operator.maxDrawdownPct)} bordered />
                <DirectoryMetric label="Record" value={operator.trackRecord ?? "—"} bordered />
              </div>
              <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-5">
                <div className="flex gap-6 text-[9px] text-[#748078]">
                  <span><b className="mb-1 block font-mono font-normal uppercase tracking-wider text-[#68746b]">Capital</b>{operator.capitalBand ?? "Not disclosed"}</span>
                  <span><b className="mb-1 block font-mono font-normal uppercase tracking-wider text-[#68746b]">Coverage</b>{operator.freshness ?? "Not available"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-[9px] text-[#7f8d82]"><input type="checkbox" checked={compare.includes(operator.slug)} onChange={() => toggleCompare(operator.slug)} aria-label={`Compare ${operator.displayName}`} /> Compare</label>
                  <Link href={operator.href ?? `/p/${operator.slug}`} aria-label={`View ${operator.displayName}`} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#b8cf9a] hover:text-[#baf277]">Inspect <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>
              </div>
            </article>
          )) : (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto h-6 w-6 text-[#778477]" />
              <h3 className="mt-4 text-sm font-medium">No records match this view.</h3>
              <p className="mt-2 text-xs text-[#8d9a8e]">Try a broader search or reset the filters.</p>
              <button type="button" onClick={clearFilters} className="mt-5 rounded-md border border-[#40503f] px-4 py-2 text-xs text-[#c6d6bd] hover:border-[#7b9369]">Clear filters</button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#2d382f] px-5 py-4">
          <p className="text-[10px] text-[#7f8d82]">{results.length} record{results.length === 1 ? "" : "s"} visible · choose two to compare</p>
          <div className="flex items-center gap-3">
            <button type="button" disabled={compare.length !== 2} onClick={() => setComparisonOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-[#baf277] px-3 py-2 text-[10px] font-medium text-[#17200e] disabled:cursor-not-allowed disabled:opacity-35">
              <GitCompareArrows className="h-3.5 w-3.5" /> Compare {compare.length}/2
            </button>
          </div>
        </div>
      </div>

      {comparisonOpen && compared.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setComparisonOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="compare-title" className="terminal-card w-full max-w-3xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-[#2d382f] p-5">
              <div><p className="terminal-label">Side-by-side / published records</p><h2 id="compare-title" className="mt-2 text-2xl font-medium">Compare the context.</h2></div>
              <button type="button" onClick={() => setComparisonOpen(false)} aria-label="Close comparison" className="rounded-md border border-[#3a493d] p-2 text-[#9eaa9f] hover:text-[#baf277]"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                <thead><tr><th className="border-b border-[#334033] py-3 font-normal text-[#819083]">Metric</th>{compared.map((item) => <th key={item.slug} className="border-b border-[#334033] px-4 py-3 text-sm font-medium text-[#e4ebdf]">{item.displayName}</th>)}</tr></thead>
                <tbody>
                  {[
                    ["Strategy", compared.map((item) => item.strategy ?? "—")],
                    ["Record source", compared.map((item) => sourceLabel(item.proofLevel))],
                    ["Period return", compared.map((item) => returnPercent(item.returnPct))],
                    ["Max drawdown", compared.map((item) => drawdownPercent(item.maxDrawdownPct))],
                    ["Capital band", compared.map((item) => item.capitalBand ?? "Not disclosed")],
                    ["Track record", compared.map((item) => item.trackRecord ?? "Published window")],
                  ].map(([label, values]) => (
                    <tr key={String(label)}><th className="border-b border-[#2a342c] py-3 font-normal text-[#849184]">{String(label)}</th>{(values as string[]).map((value, index) => <td key={`${label}-${compared[index].slug}`} className="border-b border-[#2a342c] px-4 py-3 font-mono text-[#c5d1bf]">{value}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function DirectoryMetric({ label, value, accent = false, bordered = false }: { label: string; value: string; accent?: boolean; bordered?: boolean }) {
  return <div className={`px-3 first:pl-0 ${bordered ? "border-l border-[#2f3b31]" : ""}`}><span className="block font-mono text-[8px] uppercase tracking-wider text-[#6f7c70]">{label}</span><strong className={`mt-1.5 block font-mono text-sm font-normal ${accent ? "text-[#baf277]" : "text-[#d4ddd0]"}`}>{value}</strong></div>;
}
