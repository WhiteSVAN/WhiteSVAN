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
            <stop offset="0%" stopColor="#baf277" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#baf277" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 5" stroke="#27312d" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#8a9791" }}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#8a9791" }}
          tickFormatter={(v: number) => (hideAmounts ? "" : formatMoney(v))}
          width={hideAmounts ? 8 : 56}
        />
        <Tooltip
          cursor={{ stroke: "rgba(186,242,119,0.24)", strokeDasharray: "3 3" }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #3a4a3f",
            backgroundColor: "#111713",
            color: "#f0f3ec",
          }}
          labelStyle={{ color: "#99a59c" }}
          itemStyle={{ color: "#baf277" }}
          formatter={(value: unknown) => [
            hideAmounts ? "—" : formatMoney(Number(value), { cents: true }),
            "Equity",
          ]}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#baf277"
          strokeWidth={2}
          fill="url(#equityFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
