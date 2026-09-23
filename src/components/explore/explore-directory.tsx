"use client";

/**
 * /explore directory: tabs (All · Following · Watchlist), structured filters,
 * sort, and a two-record factual comparison. Filtering is pure and instant
 * (src/lib/directory-filters.ts); the view is mirrored into the URL with
 * history.replaceState so any filtered view is shareable and bookmarkable.
 *
 * Cards arrive pre-rendered from the server (they hold the record badge and
 * follow/watchlist controls), so this component never touches the database.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  GitCompareArrows,
  Lock,
  Search,
  SlidersHorizontal,
  UserCheck,
  X,
} from "lucide-react";
import { inputClass, labelClass } from "@/components/form";
import { CAPITAL_BANDS, MARKETS, REGIONS, STRATEGY_TAGS, optionLabels, type Option } from "@/lib/profile-options";
import {
  EMPTY_FILTERS,
  EXPERIENCE_MINIMUMS,
  RECORD_LENGTHS,
  RECORD_SOURCES,
  SORT_OPTIONS,
  activeFilterCount,
  applyDirectory,
  parseDirectoryView,
  preferenceFilters,
  resolveFilters,
  serializeDirectoryView,
  tabCounts,
  type ClientPreferences,
  type DirectoryFilters,
  type DirectorySort,
  type DirectoryTab,
  type DirectoryView,
  type FilterableTrader,
} from "@/lib/directory-filters";

export type CompareFact = { label: string; value: string };

export type ExploreEntry = FilterableTrader & {
  profileId: string;
  slug: string;
  /** Factual rows for the side-by-side comparison, pre-formatted on the server. */
  facts: CompareFact[];
  /** Server-rendered card body. */
  card: ReactNode;
};

const SEARCH_DEBOUNCE_MS = 300;

function toggleKey(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

export function ExploreDirectory({
  entries,
  signedIn,
  preferences,
  initialQuery,
}: {
  entries: ExploreEntry[];
  signedIn: boolean;
  preferences: ClientPreferences | null;
  /** The request's query string, parsed once on mount. */
  initialQuery: string;
}) {
  const [view, setView] = useState<DirectoryView>(() =>
    parseDirectoryView(new URLSearchParams(initialQuery), { signedIn }),
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compareButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const hasPrefs = useMemo(() => preferenceFilters(preferences) !== null, [preferences]);
  const { filters, usingPreferences } = useMemo(() => resolveFilters(view, preferences), [view, preferences]);
  const counts = useMemo(() => tabCounts(entries), [entries]);
  const results = useMemo(
    () => applyDirectory(entries, { filters, sort: view.sort, tab: view.tab }),
    [entries, filters, view.sort, view.tab],
  );
  const activeCount = activeFilterCount(filters);
  const compared = compare
    .map((id) => entries.find((e) => e.profileId === id))
    .filter((e): e is ExploreEntry => !!e);

  useEffect(() => () => {
    if (urlTimer.current) clearTimeout(urlTimer.current);
  }, []);

  useEffect(() => {
    if (!comparisonOpen) return;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setComparisonOpen(false);
        compareButton.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      // Keep keyboard focus inside the modal dialog.
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [comparisonOpen]);

  /** Apply a new view now; mirror it into the URL (debounced for typing). */
  function commit(next: DirectoryView, delay = 0) {
    setView(next);
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const qs = serializeDirectoryView(next);
      const { pathname, search, hash } = window.location;
      const url = `${pathname}${qs ? `?${qs}` : ""}${hash}`;
      if (url !== `${pathname}${search}${hash}`) window.history.replaceState(null, "", url);
    }, delay);
  }

  /** Editing any filter makes the current (possibly prefilled) filters explicit. */
  function updateFilters(patch: Partial<DirectoryFilters>, delay = 0) {
    const nextFilters = { ...filters, ...patch };
    commit(
      { ...view, filters: nextFilters, prefsOff: hasPrefs && activeFilterCount(nextFilters) === 0 },
      delay,
    );
  }

  function resetFilters() {
    commit({ ...view, filters: EMPTY_FILTERS, prefsOff: hasPrefs });
  }

  function applyPreferences() {
    commit({ ...view, filters: EMPTY_FILTERS, prefsOff: false });
  }

  function setTab(tab: DirectoryTab) {
    commit({ ...view, tab });
  }

  function setSort(sort: DirectorySort) {
    commit({ ...view, sort });
  }

  function toggleCompare(id: string) {
    setCompare((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length === 2) return [current[1], id];
      return [...current, id];
    });
  }

  function closeComparison() {
    setComparisonOpen(false);
    compareButton.current?.focus();
  }

  const tabs: { key: DirectoryTab; label: string; icon?: ReactNode }[] = signedIn
    ? [
        { key: "all", label: "All" },
        { key: "following", label: "Following", icon: <UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> },
        { key: "watchlist", label: "Watchlist", icon: <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> },
      ]
    : [{ key: "all", label: "All" }];

  const prefSummary = usingPreferences
    ? [
        ...optionLabels("markets", filters.markets),
        ...optionLabels("regions", filters.regions),
        ...optionLabels("strategyTags", filters.strategyTags),
      ].join(" · ")
    : "";

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[#2d382f] bg-[#101511]">
        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d382f] px-4 pt-3 sm:px-5">
          <nav aria-label="Directory views" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            {tabs.map((tab) => {
              const active = view.tab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTab(tab.key)}
                  aria-pressed={active}
                  className={`flex min-h-10 items-center gap-1.5 border-b-2 pb-2 ${
                    active ? "border-[#baf277] text-[#e1e9dc]" : "border-transparent text-[#849083] hover:text-[#c5d0c1]"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span className="font-mono text-[10px] text-[#9cad92]">{counts[tab.key]}</span>
                  {tab.key === "watchlist" && (
                    <>
                      <Lock className="h-3 w-3 text-[#7f8c80]" aria-hidden="true" />
                      <span className="sr-only">(private)</span>
                    </>
                  )}
                </button>
              );
            })}
          </nav>
          <span className="terminal-label hidden items-center gap-2 pb-2 sm:flex">
            <i className="terminal-dot" /> Public records
          </span>
        </div>

        {view.tab === "watchlist" && (
          <p className="flex items-center gap-2 border-b border-[#2d382f] bg-[#0d120e] px-4 py-2.5 text-[11px] text-[#9aa79c] sm:px-5">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Your watchlist is private — only you can see it.
          </p>
        )}

        {/* Search + sort */}
        <div className="flex flex-col gap-3 border-b border-[#2d382f] p-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="explore-search" className={labelClass}>
              Search
            </label>
            <div className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 focus-within:border-zinc-400">
              <Search className="h-4 w-4 shrink-0 text-[#839085]" aria-hidden="true" />
              <input
                id="explore-search"
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                value={filters.q}
                onChange={(event) => updateFilters({ q: event.target.value }, SEARCH_DEBOUNCE_MS)}
                maxLength={100}
                className="min-w-0 flex-1 border-0 !bg-transparent p-0 text-sm text-zinc-100 outline-none !shadow-none placeholder:text-zinc-500"
                placeholder="Name, headline, or strategy"
              />
              {filters.q && (
                <button type="button" onClick={() => updateFilters({ q: "" })} aria-label="Clear search" className="text-zinc-400 hover:text-zinc-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
              <label htmlFor="explore-sort" className={labelClass}>
                Sort
              </label>
              <select
                id="explore-sort"
                value={view.sort}
                onChange={(event) => setSort(event.target.value as DirectorySort)}
                className={inputClass}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              aria-expanded={panelOpen}
              aria-controls="explore-filters"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-zinc-400 lg:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Filters{activeCount > 0 && <span className="font-mono text-[10px] text-[#baf277]">{activeCount}</span>}
            </button>
          </div>
        </div>

        {/* Preferences + active filter state */}
        {(usingPreferences || activeCount > 0 || hasPrefs) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#2d382f] px-4 py-2.5 text-[11px] sm:px-5">
            {usingPreferences ? (
              <p className="min-w-0 text-[#b7c8ae]">
                <span className="font-medium text-[#dff5c4]">Using your preferences</span>
                {prefSummary && <span className="text-[#8f9c8d]"> — {prefSummary}</span>}
                <span className="text-zinc-600"> · </span>
                <button type="button" onClick={resetFilters} className="text-[#baf277] underline-offset-2 hover:underline">
                  Clear
                </button>
              </p>
            ) : (
              <>
                {activeCount > 0 && (
                  <p className="text-[#9aa79c]">
                    {activeCount} filter{activeCount === 1 ? "" : "s"} active
                    <span className="text-zinc-600"> · </span>
                    <button type="button" onClick={resetFilters} className="text-[#baf277] underline-offset-2 hover:underline">
                      Reset filters
                    </button>
                  </p>
                )}
                {hasPrefs && (
                  <button type="button" onClick={applyPreferences} className="text-[#9cad92] underline-offset-2 hover:text-[#baf277] hover:underline">
                    Use my preferences
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Filters */}
        <div
          id="explore-filters"
          className={`${panelOpen ? "grid" : "hidden"} gap-5 border-b border-[#2d382f] p-4 lg:grid`}
        >
          <ChipFacet
            legend="Markets"
            options={MARKETS}
            selected={filters.markets}
            onToggle={(key) => updateFilters({ markets: toggleKey(filters.markets, key) })}
          />
          <ChipFacet
            legend="Strategy"
            options={STRATEGY_TAGS}
            selected={filters.strategyTags}
            onToggle={(key) => updateFilters({ strategyTags: toggleKey(filters.strategyTags, key) })}
          />
          <ChipFacet
            legend="Region"
            options={REGIONS}
            selected={filters.regions}
            onToggle={(key) => updateFilters({ regions: toggleKey(filters.regions, key) })}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              id="explore-capital"
              label="Capital band"
              value={filters.capitalBand ?? ""}
              placeholder="Any capital band"
              options={CAPITAL_BANDS}
              onChange={(value) => updateFilters({ capitalBand: value || null })}
            />
            <FilterSelect
              id="explore-source"
              label="Record source"
              value={filters.source ?? ""}
              placeholder="Any source"
              options={RECORD_SOURCES}
              onChange={(value) => updateFilters({ source: value || null })}
            />
            <FilterSelect
              id="explore-months"
              label="Record length"
              value={filters.minMonths ? String(filters.minMonths) : ""}
              placeholder="Any length"
              options={RECORD_LENGTHS.map((n) => ({ key: String(n), label: `${n}+ months` }))}
              onChange={(value) => updateFilters({ minMonths: Number(value) || 0 })}
            />
            <FilterSelect
              id="explore-experience"
              label="Experience"
              value={filters.minExperience ? String(filters.minExperience) : ""}
              placeholder="Any experience"
              options={EXPERIENCE_MINIMUMS.map((n) => ({ key: String(n), label: `${n}+ year${n === 1 ? "" : "s"}` }))}
              onChange={(value) => updateFilters({ minExperience: Number(value) || 0 })}
            />
          </div>
          <div className="flex flex-col gap-3 text-xs text-zinc-300 sm:flex-row sm:flex-wrap sm:gap-6">
            <label className="flex min-h-8 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={filters.accepting}
                onChange={(event) => updateFilters({ accepting: event.target.checked })}
                className="h-4 w-4 accent-[#baf277]"
              />
              Accepting conversation requests
            </label>
            <label className="flex min-h-8 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={filters.registered}
                onChange={(event) => updateFilters({ registered: event.target.checked })}
                className="h-4 w-4 accent-[#baf277]"
              />
              Has declared registration <span className="text-zinc-500">(self-declared)</span>
            </label>
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[10px] text-[#7f8c82] sm:px-5">
          <p aria-live="polite">
            {results.length} of {counts[view.tab]} record{counts[view.tab] === 1 ? "" : "s"} ·{" "}
            {SORT_OPTIONS.find((o) => o.key === view.sort)?.label.toLowerCase()}
          </p>
          <p>Never ranked by return or score.</p>
        </div>

        {results.length > 0 ? (
          <ul className="grid gap-px border-t border-[#263029] bg-[#263029] md:grid-cols-2">
            {results.map((entry) => (
              <li key={entry.profileId} className="flex flex-col bg-[#101511] p-4 sm:p-6">
                <article className="flex flex-1 flex-col" aria-label={entry.displayName}>
                  <div className="mb-4">{entry.card}</div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[#243026] pt-4">
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#8f9c8d]">
                      <input
                        type="checkbox"
                        checked={compare.includes(entry.profileId)}
                        onChange={() => toggleCompare(entry.profileId)}
                        aria-label={`Compare ${entry.displayName}`}
                        className="h-4 w-4 accent-[#baf277]"
                      />
                      Compare
                    </label>
                    <Link
                      href={`/p/${entry.slug}`}
                      aria-label={`Inspect ${entry.displayName}'s record`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#b8cf9a] hover:text-[#baf277]"
                    >
                      Inspect record <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyResults
            tab={view.tab}
            tabIsEmpty={counts[view.tab] === 0}
            usingPreferences={usingPreferences}
            hasFilters={activeCount > 0}
            onReset={resetFilters}
            onShowAll={() => setTab("all")}
          />
        )}

        {/* Compare tray */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2d382f] px-4 py-4 sm:px-5">
          <p className="min-w-0 text-[11px] text-[#8f9c8d]">
            {compared.length === 0
              ? "Tick Compare on two records to see them side by side."
              : compared.map((e) => e.displayName).join(" vs ")}
            {compared.length > 0 && (
              <button type="button" onClick={() => setCompare([])} className="ml-2 text-[#9cad92] hover:text-[#baf277]">
                Clear
              </button>
            )}
          </p>
          <button
            ref={compareButton}
            type="button"
            disabled={compared.length !== 2}
            onClick={() => setComparisonOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#baf277] px-3 text-[11px] font-medium text-[#17200e] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" /> Compare {compared.length}/2
          </button>
        </div>

        <p className="border-t border-[#2d382f] px-4 py-3 text-[10px] leading-5 text-[#7f8c82] sm:px-5">
          Returns and drawdowns are historical figures from each trader&apos;s published snapshot — context, not a ranking or
          recommendation. Credentials and registrations are self-declared. Past performance does not guarantee future results.
        </p>
      </div>

      {comparisonOpen && compared.length === 2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="presentation"
          onMouseDown={(event) => event.currentTarget === event.target && closeComparison()}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="compare-title"
            className="terminal-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#2d382f] p-4 sm:p-5">
              <div>
                <p className="terminal-label">Side by side / published records</p>
                <h2 id="compare-title" className="mt-2 text-xl font-medium sm:text-2xl">
                  Compare the context.
                </h2>
              </div>
              <button
                ref={closeButton}
                type="button"
                onClick={closeComparison}
                aria-label="Close comparison"
                className="rounded-md border border-[#3a493d] p-2 text-[#9eaa9f] hover:text-[#baf277]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <thead>
                  <tr>
                    <th scope="col" className="w-[28%] border-b border-[#334033] py-3 font-normal text-[#819083]">
                      <span className="sr-only">Fact</span>
                    </th>
                    {compared.map((item) => (
                      <th key={item.profileId} scope="col" className="break-words border-b border-[#334033] px-2 py-3 text-sm font-medium text-[#e4ebdf] sm:px-4">
                        <Link href={`/p/${item.slug}`} className="hover:text-[#baf277]">
                          {item.displayName}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compared[0].facts.map((fact, row) => (
                    <tr key={fact.label}>
                      <th scope="row" className="border-b border-[#2a342c] py-3 pr-2 align-top font-normal text-[#849184]">
                        {fact.label}
                      </th>
                      {compared.map((item) => (
                        <td key={item.profileId} className="break-words border-b border-[#2a342c] px-2 py-3 align-top font-mono text-[#c5d1bf] sm:px-4">
                          {item.facts[row]?.value ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-[10px] leading-5 text-[#7f8c82]">
                Figures come from each trader&apos;s latest published snapshot and may cover different windows. This is a factual
                comparison, not a recommendation. Past performance does not guarantee future results.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ChipFacet({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: Option[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.key)}
              className={`min-h-8 rounded-md border px-2.5 py-1 text-xs transition ${
                on
                  ? "border-[#baf277] bg-[#1a2418] text-[#dff5c4]"
                  : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FilterSelect({
  id,
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyResults({
  tab,
  tabIsEmpty,
  usingPreferences,
  hasFilters,
  onReset,
  onShowAll,
}: {
  tab: DirectoryTab;
  tabIsEmpty: boolean;
  usingPreferences: boolean;
  hasFilters: boolean;
  onReset: () => void;
  onShowAll: () => void;
}) {
  let title = "No records match these filters.";
  let body = "Try fewer filters or a broader search.";
  let action: ReactNode = hasFilters ? (
    <button type="button" onClick={onReset} className="mt-5 rounded-md border border-[#40503f] px-4 py-2 text-xs text-[#c6d6bd] hover:border-[#7b9369]">
      {usingPreferences ? "Clear preferences" : "Reset filters"}
    </button>
  ) : null;

  if (tabIsEmpty && tab === "following") {
    title = "You aren't following any records yet.";
    body = "Follow a trader to see their posts and record updates in your feed.";
    action = null;
  } else if (tabIsEmpty && tab === "watchlist") {
    title = "Your watchlist is empty.";
    body = "Use Watchlist on any record to keep it here. Only you can see your watchlist.";
    action = null;
  }

  return (
    <div className="border-t border-[#263029] px-6 py-14 text-center">
      <Search className="mx-auto h-6 w-6 text-[#778477]" aria-hidden="true" />
      <h3 className="mt-4 text-sm font-medium text-zinc-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#8d9a8e]">{body}</p>
      {action}
      {tabIsEmpty && tab !== "all" && (
        <button type="button" onClick={onShowAll} className="mt-5 rounded-md border border-[#40503f] px-4 py-2 text-xs text-[#c6d6bd] hover:border-[#7b9369]">
          Browse all records
        </button>
      )}
    </div>
  );
}
