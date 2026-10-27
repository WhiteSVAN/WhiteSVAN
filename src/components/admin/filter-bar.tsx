/** The filter row above an admin list: a plain GET form, so every filtered view is a link. */
const field = "mt-1 block min-h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)]";

export interface FilterField {
  name: string;
  label: string;
  value?: string;
  /** A select's options as [value, label]; a text or date input otherwise. */
  options?: readonly (readonly [string, string])[];
  type?: "text" | "date";
  placeholder?: string;
  width?: string;
}

export function FilterBar({ fields, reset, children }: { fields: readonly FilterField[]; reset: string; children?: React.ReactNode }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filters">
      {fields.map((item) => (
        <label key={item.name} className="text-xs text-[var(--muted)]">{item.label}
          {item.options ? (
            <select name={item.name} defaultValue={item.value ?? ""} className={field}>
              <option value="">All</option>
              {item.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          ) : (
            <input name={item.name} type={item.type ?? "text"} defaultValue={item.value ?? ""} placeholder={item.placeholder} className={`${field} ${item.width ?? "w-40"}`} />
          )}
        </label>
      ))}
      <button type="submit" className="min-h-10 rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-[var(--ink-foreground)] hover:bg-[var(--ink-hover)]">Apply</button>
      <a href={reset} className="min-h-10 content-center px-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Clear</a>
      {children}
    </form>
  );
}
