import Link from "next/link";
import { Check, Circle } from "lucide-react";

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

/** "Complete your record" — factual setup steps, never a score. */
export function RecordChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length;
  const complete = done === items.length;

  return (
    <section className="terminal-card p-5" aria-labelledby="record-checklist">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="record-checklist" className="text-base font-medium text-zinc-800">
          {complete ? "Record set up" : "Complete your record"}
        </h2>
        <span className="font-mono text-xs text-zinc-500">
          {done}/{items.length} done
        </span>
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-label="Setup steps completed"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
      >
        <div className="h-full rounded-full bg-[#baf277]" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      {complete ? (
        <p className="mt-3 text-sm text-zinc-500">
          Everything a client needs to review your record is in place. Keep publishing updates so
          your coverage stays current.
        </p>
      ) : (
        <ul className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.key}>
              {item.done ? (
                <span className="flex items-center gap-2 py-1 text-sm text-zinc-500">
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#baf277]" aria-hidden="true" />
                  <span className="line-through decoration-zinc-700">{item.label}</span>
                  <span className="sr-only">(done)</span>
                </span>
              ) : (
                <Link href={item.href} className="flex items-center gap-2 py-1 text-sm text-zinc-200 hover:text-[#baf277]">
                  <Circle className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  {item.label}
                  <span className="sr-only">(to do)</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
