import { formatMoney } from "@/lib/format";

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  netPnl: number;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function compact(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "+";
  return a >= 1000 ? `${sign}${(a / 1000).toFixed(1)}k` : `${sign}${Math.round(a)}`;
}

/** Monthly P&L calendar — green/red day cells, intensity scaled by size. */
export function CalendarHeatmap({ data, hideAmounts }: { data: CalendarDay[]; hideAmounts?: boolean }) {
  if (data.length === 0) return null;
  const byDate = new Map(data.map((d) => [d.date, d.netPnl]));
  const months = [...new Set(data.map((d) => d.date.slice(0, 7)))].sort().slice(-3);
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.netPnl)));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-800">Calendar</h2>
      <p className="text-xs text-slate-400">Green and red days at a glance.</p>
      <div className="mt-3 grid gap-6 md:grid-cols-3">
        {months.map((mk) => (
          <Month key={mk} mk={mk} byDate={byDate} maxAbs={maxAbs} hideAmounts={hideAmounts} />
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
}: {
  mk: string;
  byDate: Map<string, number>;
  maxAbs: number;
  hideAmounts?: boolean;
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
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-center text-[10px] text-slate-400">
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
            ? "rgba(148,163,184,0.08)"
            : pnl >= 0
              ? `rgba(16,185,129,${0.15 + intensity * 0.55})`
              : `rgba(239,68,68,${0.15 + intensity * 0.55})`;
          return (
            <div
              key={i}
              className="rounded px-1 py-1 text-center"
              style={{ backgroundColor: bg }}
              title={has && !hideAmounts ? formatMoney(pnl) : undefined}
            >
              <div className={`text-[10px] ${has ? "font-medium text-slate-700" : "text-slate-500"}`}>
                {d}
              </div>
              {has && !hideAmounts && (
                <div className="text-[9px] tabular-nums text-slate-600">{compact(pnl)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
