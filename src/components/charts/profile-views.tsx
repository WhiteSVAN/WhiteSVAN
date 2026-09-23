"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ViewPoint {
  date: string; // YYYY-MM-DD
  views: number;
}

const DAY_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayLabel = (iso: string) => DAY_LABEL.format(new Date(`${iso}T00:00:00Z`));

/** Profile views per day — a single series in the terminal accent, zero-filled. */
export function ProfileViewsChart({ data }: { data: ViewPoint[] }) {
  const total = data.reduce((n, d) => n + d.views, 0);
  return (
    <div role="img" aria-label={`Profile views per day: ${total} views over ${data.length} days`}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid strokeDasharray="3 5" stroke="#27312d" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#8a9791" }}
            tickFormatter={dayLabel}
            minTickGap={24}
            tickLine={false}
            axisLine={{ stroke: "#526057" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "#8a9791" }}
            width={32}
            tickLine={false}
            axisLine={false}
          />
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
            labelFormatter={(label: unknown) => dayLabel(String(label))}
            formatter={(value: unknown) => [String(value), "Views"]}
          />
          <Bar dataKey="views" fill="#baf277" radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
