import { formatCompactSigned, formatMoney } from "@/lib/format";

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  netPnl: number;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Monthly P&L calendar with terminal-theme intensity scaled by size. */
export function CalendarHeatmap({
  data,
  hideAmounts,
  currency = "USD",
}: {
  data: CalendarDay[];
  hideAmounts?: boolean;
  /** ISO 4217 account currency (default USD). */
  currency?: string;
}) {
  if (data.length === 0) return null;
  const byDate = new Map(data.map((d) => [d.date, d.netPnl]));
  const months = [...new Set(data.map((d) => d.date.slice(0, 7)))].sort().slice(-3);
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.netPnl)));

  return (
    <div className="terminal-card p-4">
      <h2 className="text-sm font-medium text-white">Calendar</h2>
      <p className="text-xs text-zinc-400">Winning and losing days at a glance.</p>
      <div className="mt-3 grid gap-6 md:grid-cols-3">
        {months.map((mk) => (
          <Month
            key={mk}
            mk={mk}
            byDate={byDate}
            maxAbs={maxAbs}
            hideAmounts={hideAmounts}
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
}

function Month({
  mk,
  byDate,
  maxAbs,
  hideAmounts,
  currency,
}: {
  mk: string;
  byDate: Map<string, number>;
  maxAbs: number;
  hideAmounts?: boolean;
  currency: string;
}) {
  const [y, m] = mk.split("-").map(Number);
  const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <p className="text-xs font-medium text-zinc-300">{label}</p>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-center text-[10px] text-zinc-400">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <span key={i} />;
          const iso = `${mk}-${String(d).padStart(2, "0")}`;
          const pnl = byDate.get(iso);
          const has = pnl != null;
          const intensity = has ? Math.min(1, Math.abs(pnl) / maxAbs) : 0;
          const bg = !has
            ? "rgba(117,128,121,0.12)"
            : pnl >= 0
              ? `rgba(186,242,119,${0.12 + intensity * 0.45})`
              : `rgba(242,144,126,${0.12 + intensity * 0.42})`;
          return (
            <div
              key={i}
              className="rounded px-1 py-1 text-center"
              style={{ backgroundColor: bg }}
              title={has && !hideAmounts ? formatMoney(pnl, { currency }) : undefined}
            >
              <div className={`text-[10px] ${has ? "font-medium text-white" : "text-zinc-500"}`}>
                {d}
              </div>
              {has && !hideAmounts && (
                <div className="text-[9px] tabular-nums text-zinc-300">{formatCompactSigned(pnl, currency)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
