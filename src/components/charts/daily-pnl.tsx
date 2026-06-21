"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

export interface DailyPoint {
  date: string;
  netPnl: number;
}

/** Net P&L per trading day — green bars for green days, red for red. */
export function DailyPnlChart({ data, hideAmounts }: { data: DailyPoint[]; hideAmounts?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
        <ReferenceLine y={0} stroke="#475569" />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
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
            "Net P&L",
          ]}
        />
        <Bar dataKey="netPnl" radius={[2, 2, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.netPnl >= 0 ? "#059669" : "#dc2626"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
