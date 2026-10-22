"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EVALUATION_PLANS, formatInr, PROGRAMME_RULES as R, type EvaluationPlan } from "@/lib/prop-firm";
import { programmePreview } from "@/lib/programme-preview";

export function AccountPreview() {
  const [plan, setPlan] = useState<EvaluationPlan>(EVALUATION_PLANS[1]);
  const [tab, setTab] = useState<"equity" | "rules">("equity");
  const id = useId().replaceAll(":", "");
  const preview = programmePreview(plan);

  return (
    <div className="prop-hero-art relative mx-auto w-full max-w-[590px] py-6 lg:py-12">
      <div aria-hidden="true" className="prop-orbit" />
      <section aria-label="Interactive sample evaluation account" className="prop-terminal relative overflow-hidden rounded-2xl border border-[#4d663d] bg-[#101811] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d3c2a] px-5 py-4">
          <span className="flex items-center gap-2 text-xs font-medium"><span className="terminal-dot" /> WhiteSVAN Trader</span>
          <span className="rounded-full border border-[#405434] bg-[#1d2b17] px-2.5 py-1 font-mono text-[8px] uppercase tracking-widest text-[#c3e6a5]">Interactive demo</span>
        </div>
        <div className="p-5 sm:p-7">
          <fieldset>
            <legend className="font-mono text-[9px] uppercase tracking-widest text-[#8f9e88]">Explore an account size</legend>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {EVALUATION_PLANS.map((option) => (
                <button key={option.id} type="button" aria-pressed={option.id === plan.id} onClick={() => setPlan(option)} className={`min-h-10 rounded-md border text-xs ${option.id === plan.id ? "border-[#baf277] bg-[#253719] text-[#dff5c4]" : "border-[#33442c] text-[#99aa8d] hover:border-[#779b55]"}`}>{option.label}</button>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 flex items-start justify-between gap-4" aria-live="polite" aria-atomic="true">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8f9e88]">Sample equity / {plan.label} evaluation</p>
              <p className="mt-3 break-all text-[clamp(1.8rem,3.4vw,2.75rem)] font-medium leading-none tracking-[-.06em]">{formatInr(preview.equity)}</p>
              <p className="mt-3 text-[11px] text-[#a8c989]">+{formatInr(preview.pnl)} <span className="ml-2 text-[#7e8c77]">Illustrative P&amp;L</span></p>
            </div>
            <TrendingUp className="h-10 w-10 shrink-0 rounded-xl border border-[#526a3e] bg-[#21331a] p-2.5 text-[#baf277]" aria-hidden="true" />
          </div>
          <div className="mt-6 flex gap-5 border-b border-[#2d3c2a]" aria-label="Preview views">
            {(["equity", "rules"] as const).map((key) => (
              <button key={key} type="button" aria-pressed={tab === key} aria-controls={`${id}-panel`} onClick={() => setTab(key)} className={`min-h-10 border-b-2 text-xs ${tab === key ? "border-[#baf277] text-[#dff5c4]" : "border-transparent text-[#8f9e88]"}`}>{key === "equity" ? "Sample equity" : "Account rules"}</button>
            ))}
          </div>
          <div id={`${id}-panel`} className="min-h-48 pt-4">
            {tab === "equity" ? (
              <div className="h-44 w-full" role="img" aria-label={`Illustrative ten-day equity, ending at ${formatInr(preview.equity)}. Not a real trading record.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={preview.series} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                    <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#baf277" stopOpacity={0.22} /><stop offset="100%" stopColor="#baf277" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="#273723" strokeDasharray="3 5" />
                    <XAxis dataKey="day" tickFormatter={(value) => `D${value}`} tick={{ fill: "#76866e", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Tooltip formatter={(value) => [formatInr(Number(value)), "Sample equity"]} labelFormatter={(value) => `Illustrative day ${value}`} contentStyle={{ background: "#101811", border: "1px solid #405434", color: "#f0f3ec", borderRadius: 8, fontSize: 11 }} />
                    <Area type="linear" dataKey="equity" stroke="#baf277" strokeWidth={2} fill={`url(#${id}-fill)`} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <dl className="divide-y divide-[#273723] text-xs">
                {[["Daily loss limit", formatInr(preview.limits.dailyLoss)], ["End-of-day drawdown", formatInr(preview.limits.maximumLoss)], ["Maximum position size", `${plan.lots} lot${plan.lots === 1 ? "" : "s"}`], ["Minimum trading days", String(R.minimumDays)], ["Square-off", `${R.squareOff} IST`]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-2.5"><dt className="text-[#8f9e88]">{label}</dt><dd className="font-mono text-[#d4e6c6]">{value}</dd></div>)}
              </dl>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-[#2d3d27] bg-[#142010] p-3.5">
            <div className="flex justify-between gap-3 text-[10px]"><span className="text-[#99aa8d]">Sample profit target progress</span><span className="font-mono text-[#cce1b6]">{formatInr(preview.pnl)} / {formatInr(preview.limits.profitTarget)}</span></div>
            <div className="mt-3 h-1 rounded-full bg-[#2c3c23]" role="progressbar" aria-label="Illustrative profit target progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(preview.targetProgress)}><div style={{ width: `${preview.targetProgress}%` }} className="h-full rounded-full bg-[#baf277]" /></div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-[9px] leading-5 text-[#8f9e88]"><ShieldCheck size={12} className="mt-1 shrink-0" aria-hidden="true" />Illustrative data, not live prices or a forecast. All evaluation and funded accounts are simulated.</p>
          <Link href={`/evaluations/${plan.id}`} className="mt-4 flex min-h-10 items-center justify-between gap-3 border-t border-[#2d3c2a] pt-4 text-xs text-[#cce1b6]">View {plan.label} evaluation <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
