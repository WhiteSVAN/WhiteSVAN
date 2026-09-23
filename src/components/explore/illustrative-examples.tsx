/**
 * Fictional example records, shown in their own clearly labelled section below
 * the real directory. They are never mixed into results, counts, filters,
 * tabs, or comparisons.
 */
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import type { ExampleOperator } from "@/lib/example-operators";

export function IllustrativeExamples({ examples }: { examples: ExampleOperator[] }) {
  if (examples.length === 0) return null;
  return (
    <section aria-labelledby="examples-title" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-[#3a4536] pb-4">
        <div>
          <p className="terminal-label flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5 text-[#a8b59c]" aria-hidden="true" /> Illustrative
          </p>
          <h2 id="examples-title" className="mt-2 text-xl font-medium tracking-tight text-zinc-100 sm:text-2xl">
            Illustrative examples — fictional, not real records
          </h2>
        </div>
        <p className="max-w-md text-xs leading-5 text-[#8f9c8d]">
          These invented profiles show how a record reads. They are not traders, are not included in the results, filters,
          counts, or comparisons above, and their figures are made up.
        </p>
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {examples.map((example) => (
          <li key={example.slug}>
            <article className="flex h-full flex-col rounded-lg border border-dashed border-[#3a4536] bg-[#0e120f] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/examples/${example.slug}`}
                  className="min-w-0 break-words text-sm font-medium text-[#d9e2d4] hover:text-[#baf277]"
                >
                  {example.displayName}
                </Link>
                <span className="rounded border border-[#485342] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#96a28e]">
                  Fictional example
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#7f8c80]">
                {example.location} · {example.strategy}
              </p>
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-[#9aa79c]">{example.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#2a342c] pt-3 text-[10px]">
                <div>
                  <dt className="font-mono uppercase tracking-wider text-[#6f7c70]">Record length</dt>
                  <dd className="mt-1 text-[#b7c3b1]">{example.trackRecord}</dd>
                </div>
                <div>
                  <dt className="font-mono uppercase tracking-wider text-[#6f7c70]">Capital band</dt>
                  <dd className="mt-1 text-[#b7c3b1]">{example.capitalBand}</dd>
                </div>
              </dl>
              <Link
                href={`/examples/${example.slug}`}
                aria-label={`Open the fictional example ${example.displayName}`}
                className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[11px] text-[#a9bd93] hover:text-[#baf277]"
              >
                View example <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
