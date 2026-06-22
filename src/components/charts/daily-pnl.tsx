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

/** Net P&L per trading day — emerald bars for green days, coral for red. */
export function DailyPnlChart({ data, hideAmounts }: { data: DailyPoint[]; hideAmounts?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          tickFormatter={(v: number) => (hideAmounts ? "" : formatMoney(v))}
          width={hideAmounts ? 8 : 56}
        />
        <ReferenceLine y={0} stroke="#52525b" />
        <Tooltip
          cursor={{ fill: "rgba(161,161,170,0.12)" }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #27272a",
            backgroundColor: "#080808",
            color: "#f4f4f5",
          }}
          labelStyle={{ color: "#a1a1aa" }}
          itemStyle={{ color: "#f4f4f5" }}
          formatter={(value: unknown) => [
            hideAmounts ? "—" : formatMoney(Number(value), { cents: true }),
            "Net P&L",
          ]}
        />
        <Bar dataKey="netPnl" radius={[2, 2, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.netPnl >= 0 ? "#34d399" : "#f87171"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
