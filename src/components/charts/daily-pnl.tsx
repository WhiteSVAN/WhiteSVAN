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

/** Net P&L per trading day — terminal lime for gains, muted coral for losses. */
export function DailyPnlChart({
  data,
  hideAmounts,
  currency = "USD",
}: {
  data: DailyPoint[];
  hideAmounts?: boolean;
  /** ISO 4217 account currency (default USD). */
  currency?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 5" stroke="#27312d" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#8a9791" }}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#8a9791" }}
          tickFormatter={(v: number) => (hideAmounts ? "" : formatMoney(v, { currency }))}
          width={hideAmounts ? 8 : currency === "USD" ? 56 : 72}
        />
        <ReferenceLine y={0} stroke="#526057" />
        <Tooltip
          cursor={{ fill: "rgba(186,242,119,0.07)" }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #3a4a3f",
            backgroundColor: "#111713",
            color: "#f0f3ec",
          }}
          labelStyle={{ color: "#99a59c" }}
          itemStyle={{ color: "#f0f3ec" }}
          formatter={(value: unknown) => [
            hideAmounts ? "—" : formatMoney(Number(value), { cents: true, currency }),
            "Net P&L",
          ]}
        />
        <Bar dataKey="netPnl" radius={[2, 2, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.netPnl >= 0 ? "#baf277" : "#f2907e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
