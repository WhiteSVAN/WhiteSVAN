"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

export interface EquityPoint {
  date: string;
  equity: number;
}

/** Account equity over the selected window (starting balance + cumulative P&L). */
export function EquityCurveChart({ data, hideAmounts }: { data: EquityPoint[]; hideAmounts?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(v: number) => (hideAmounts ? "" : formatMoney(v))}
          width={hideAmounts ? 8 : 56}
        />
        <Tooltip
          cursor={{ stroke: "rgba(148,163,184,0.25)" }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #1f2937",
            backgroundColor: "#0b1120",
            color: "#e5edf5",
          }}
          labelStyle={{ color: "#94a3b8" }}
          itemStyle={{ color: "#e5edf5" }}
          formatter={(value: unknown) => [
            hideAmounts ? "—" : formatMoney(Number(value), { cents: true }),
            "Equity",
          ]}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#1d4ed8"
          strokeWidth={2}
          fill="url(#equityFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
