"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Info,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

const VALUES = [100, 103, 101, 106, 105, 110, 112, 109, 116, 119, 117, 123, 126, 124, 132, 130, 135, 138];

type Tab = "performance" | "risk" | "evidence";

function EquityPreview() {
  const gradientId = useId().replaceAll(":", "");
  const width = 600;
  const height = 145;
  const pad = 8;
  const min = Math.min(...VALUES) - 2;
  const max = Math.max(...VALUES) + 2;
  const x = (index: number) => pad + (index / (VALUES.length - 1)) * (width - pad * 2);
  const y = (value: number) => pad + (1 - (value - min) / (max - min)) * (height - pad * 2);
  const line = VALUES.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(value)}`).join(" ");
  const area = `${line} L${x(VALUES.length - 1)} ${height} L${x(0)} ${height} Z`;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-[9px] text-[#879586]">
        <span className="flex items-center gap-2 font-mono uppercase tracking-wide">
          <i className="terminal-dot" /> Indexed equity <span className="hidden sm:inline">· Jan 2024 = 100</span>
        </span>
        <span className="rounded bg-[#27351e] px-2 py-1 font-mono text-[#c4ddaa]">1Y</span>
      </div>
      <svg
        className="mt-3 h-32 w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Illustrative indexed equity curve rising from 100 to 138"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#baf277" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#baf277" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 75, 115].map((lineY) => (
          <line key={lineY} x1="0" x2={width} y1={lineY} y2={lineY} stroke="#27312d" strokeDasharray="4 7" />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} className="proof-chart-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="grid grid-cols-3 border-t border-[#2d392d] pt-4">
        {[
          ["CAGR", "+38.4%", true],
          ["Sharpe ratio", "2.10", false],
          ["Max. drawdown", "5.8%", false],
        ].map(([label, value, accent], index) => (
          <div key={String(label)} className={`px-3 ${index ? "border-l border-[#334033]" : ""}`}>
            <span className="block text-[9px] text-[#8e9a8d]">{label}</span>
            <strong className={`mt-2 block font-mono text-lg font-normal ${accent ? "text-[#baf277]" : "text-[#e3e8df]"}`}>
              {value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskPreview() {
  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-md border border-[#6e69443d] bg-[#b7ae5b0a] p-4 text-[#d7cd9e]">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <strong className="text-sm font-medium">Look beyond the return.</strong>
          <p className="mt-1 text-xs leading-5 text-[#b6b18f]">Verification is evidence context, not a safety rating.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="border-r border-[#334033] pr-4">
          <span className="terminal-label">Maximum drawdown</span>
          <strong className="mt-2 block font-mono text-2xl font-normal text-[#d8c899]">5.8%</strong>
          <small className="text-[10px] text-[#9fa98e]">Peak-to-trough decline</small>
        </div>
        <div>
          <span className="terminal-label">Recovery window</span>
          <strong className="mt-2 block font-mono text-2xl font-normal text-[#d8c899]">18 days</strong>
          <small className="text-[10px] text-[#9fa98e]">Illustrative recovery period</small>
        </div>
      </div>
      <p className="border-t border-[#334033] pt-4 text-xs leading-5 text-[#b7c39f]">
        Monitor concentration and whether the record remains resilient as the observation window expands.
      </p>
    </div>
  );
}

function EvidencePreview() {
  const rows = [
    ["Broker connection", "Read-only trade and balance history"],
    ["Statement check", "Reconciled against account statements"],
    ["Tax-record check", "Additional supporting documentation"],
  ];
  return (
    <div>
      {rows.map(([name, description], index) => (
        <div key={name} className="flex items-center gap-3 border-b border-[#334033] py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#91b25b80] bg-[#9fbd610c] text-[#c4e598]">
            <Check className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-xs font-normal text-[#d9e6c4]">{name}</strong>
            <p className="mt-1 text-[10px] text-[#9faf8c]">{description}</p>
          </div>
          <span className="font-mono text-[10px] text-[#a4ba83]">0{index + 1}</span>
        </div>
      ))}
      <p className="mt-4 flex items-start gap-2 text-[10px] leading-5 text-[#aeb990]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Documents remain private unless the operator explicitly publishes them.
      </p>
    </div>
  );
}

export function ProofTerminal() {
  const [tab, setTab] = useState<Tab>("performance");
  const tabs: { key: Tab; label: string }[] = [
    { key: "performance", label: "Performance" },
    { key: "risk", label: "Risk context" },
    { key: "evidence", label: "Evidence · 3" },
  ];

  return (
    <div className="relative min-w-0">
      <div className="proof-ambient pointer-events-none absolute -inset-20 -z-10" />
      <div className="mb-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-[#829079]">
        <span>The record, not the reputation</span>
        <span>01 / 04</span>
      </div>
      <div className="terminal-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2e382a] px-4 py-3 font-mono text-[9px] text-[#93a08a]">
          <span className="flex items-center gap-2">
            <i className="terminal-dot" /> trustsvan / operator-record
          </span>
          <span className="uppercase tracking-wider">Live product preview</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-5 py-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#5b7738] bg-[#304720] font-mono text-sm text-[#dce9cc]">SA</span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-medium text-[#eef3e9]">
              Sofia Alvarez <ShieldCheck className="h-4 w-4 text-[#baf277]" />
            </h2>
            <p className="mt-1 text-xs text-[#8e9b89]">Systematic futures · ES · SPX</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded border border-[#6d8e3e66] bg-[#24331c] px-2.5 py-1.5 text-[10px] text-[#c4deaa]">
            <ShieldCheck className="h-3.5 w-3.5" /> Tax checked
          </span>
        </div>
        <div className="px-5">
          <div className="flex gap-6 border-b border-[#334033]" role="tablist" aria-label="Record preview">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={`relative pb-3 text-xs ${tab === item.key ? "text-[#dceacb] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[#baf277]" : "text-[#7f8d78] hover:text-[#b9c5af]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="min-h-[290px] py-5" role="tabpanel">
            {tab === "performance" && (
              <div>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <span className="terminal-label block">Verified capital base</span>
                    <strong className="mt-1 block font-mono text-3xl font-normal text-[#eef3e9]">$1.20M</strong>
                  </div>
                  <span className="font-mono text-[10px] text-[#baf277]">↗ +38.4% sample year</span>
                </div>
                <EquityPreview />
              </div>
            )}
            {tab === "risk" && <RiskPreview />}
            {tab === "evidence" && <EvidencePreview />}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#2e382a] px-5 py-4 text-[10px] text-[#8d9b84]">
          <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Read-only by design</span>
          <Link href="/explore" className="flex items-center gap-2 font-medium text-[#b9d296] hover:text-[#baf277]">
            Inspect records <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <div className="mt-3 flex justify-between font-mono text-[9px] text-[#7f8e78]">
        <span className="flex items-center gap-1.5"><Check className="h-3 w-3" /> Returns + risk + evidence</span>
        <span>Try the tabs above</span>
      </div>
    </div>
  );
}
