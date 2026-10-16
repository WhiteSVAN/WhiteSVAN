"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { HELP_TOPICS, searchHelp } from "@/lib/help-center";

export function HelpCenter() {
  const [query, setQuery] = useState("");
  const topics = useMemo(() => searchHelp(HELP_TOPICS, query), [query]);
  const searching = query.trim().length > 0;
  const matches = topics.reduce((total, topic) => total + topic.articles.length, 0);

  return (
    <>
      <div role="search" className="mx-auto mt-9 max-w-2xl">
        <label htmlFor="help-search" className="sr-only">Search the help center</label>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search: drawdown, payouts, KYC…"
            className="min-h-14 w-full rounded-full border border-[var(--border-strong)] bg-[var(--card)] pl-13 pr-6 text-sm text-[var(--foreground)] placeholder:text-[var(--faint)] focus:border-[var(--primary)] focus:outline-none"
          />
        </div>
        <p className="mt-3 min-h-5 text-center text-xs text-[var(--muted)]" aria-live="polite">
          {searching ? `${matches} ${matches === 1 ? "answer" : "answers"} for “${query.trim()}”` : ""}
        </p>
      </div>

      {!searching && (
        <nav aria-label="Help topics" className="mx-auto mt-6 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_TOPICS.map((topic) => (
            <a key={topic.id} href={`#${topic.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-left transition hover:border-[var(--primary)]">
              <span className="block text-sm font-medium">{topic.title}</span>
              <span className="mt-1.5 block text-xs leading-5 text-[var(--muted)]">{topic.summary}</span>
              <span className="mt-3 block font-mono text-[10px] uppercase tracking-wider text-[var(--primary)]">{topic.articles.length} articles</span>
            </a>
          ))}
        </nav>
      )}

      <div className="mx-auto mt-14 max-w-4xl space-y-12 text-left">
        {topics.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--muted)]">
            No answers match that search. Try “drawdown”, “KYC” or “payout”.
          </p>
        )}
        {topics.map((topic) => (
          <section key={topic.id} id={topic.id} aria-labelledby={`${topic.id}-title`} className="scroll-mt-28">
            <p className="terminal-label text-[var(--primary)]">{topic.articles.length} {topic.articles.length === 1 ? "article" : "articles"}</p>
            <h2 id={`${topic.id}-title`} className="mt-2 text-2xl font-medium tracking-[-.035em]">{topic.title}</h2>
            <div className="mt-5 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {topic.articles.map((article) => (
                <details key={`${article.id}-${searching}`} id={article.id} open={searching} className="group scroll-mt-28 py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-sm font-medium sm:text-base [&::-webkit-details-marker]:hidden">
                    {article.question}
                    <ChevronDown size={17} className="shrink-0 text-[var(--primary)] transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="max-w-3xl pb-6 pr-6 text-sm leading-7 text-[var(--muted)]">{article.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
