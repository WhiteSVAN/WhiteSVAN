/**
 * Shared prompt construction. The system prompt is the
 * compliance guardrail; the user prompt feeds verified metrics
 * as text so the model explains numbers it never has to compute.
 */
import type { Metrics } from "@/lib/metrics";
import { formatMoney, formatPercent } from "@/lib/format";

export const SYSTEM_PROMPT = `You are a reporting assistant for a trader analytics tool.
Use only the historical metrics and notes provided. Never calculate, estimate, or invent numbers.
Do not recommend buying, selling, holding, copying, allocating, or investing.
Do not predict or imply future returns.
Do not use words such as guaranteed, safe, risk-free, certain, or assured.
Discuss only past performance, risk, discipline, and process, written in the third person about the trader.
Write in a professional, plain style suitable for a trader research network.
The client_disclaimer field must state that past performance does not guarantee future results.
Return only valid JSON matching the requested schema.`;

export interface ReportNotes {
  strategy?: string | null;
  instruments?: string | null;
  riskRules?: string | null;
}

/** truSVAN signals, so the brief mirrors the dashboard. */
export interface ReportSignals {
  bestDayShare: number | null;
  drawdownSeverity: string;
  badToGoodRatio: number | null;
  bounceBackDays: number | null;
  transparencyScore: number;
}

export interface ReportInput {
  period: string; // "YYYY-MM"
  accountName: string;
  startingBalance: number;
  metrics: Metrics;
  notes?: ReportNotes;
  signals?: ReportSignals;
}

export function buildUserPrompt(input: ReportInput): string {
  const m = input.metrics;
  const facts = [
    `Reporting period: ${input.period}`,
    `Account: ${input.accountName}`,
    `Starting balance: ${formatMoney(input.startingBalance)}`,
    `Net P&L: ${formatMoney(m.netPnl)}`,
    `Return on starting balance: ${m.returnPct != null ? formatPercent(m.returnPct, 1) : "n/a"}`,
    `Trading days: ${m.tradingDays} (winning ${m.winningDays}, losing ${m.losingDays})`,
    `Win rate: ${formatPercent(m.winRate)}`,
    `Best day: ${formatMoney(m.bestDay)}; worst day: ${formatMoney(m.worstDay)}`,
    `Average green day: ${formatMoney(m.avgGreenDay)}; average red day: ${formatMoney(m.avgRedDay)}`,
    `Profit factor: ${m.profitFactor != null ? m.profitFactor.toFixed(2) : "n/a"}`,
    `Max drawdown: ${formatMoney(m.maxDrawdown)} (${m.maxDrawdownPct.toFixed(1)}% of peak equity)`,
    `Consistency score: ${m.consistencyScore} out of 100`,
  ];
  if (input.notes?.strategy) facts.push(`Trader's strategy notes: ${input.notes.strategy}`);
  if (input.notes?.instruments) facts.push(`Instruments traded: ${input.notes.instruments}`);
  if (input.notes?.riskRules) facts.push(`Trader's stated risk rules: ${input.notes.riskRules}`);

  return [
    "Write a monthly truSVAN research brief from these verified metrics. Use only the numbers given.",
    "",
    facts.join("\n"),
    "",
    "Return a JSON object with exactly these fields:",
    "- executive_summary (string): a professional overview of the month.",
    "- performance_summary (string): what happened, using the verified metrics.",
    "- risk_summary (string): drawdown, worst day, volatility, concentration.",
    "- discipline_review (string): consistency, red-day frequency, single-day dependence.",
    "- notable_days (array of strings): brief callouts such as best day and worst day.",
    "- warnings (array of strings): plain-English, non-advisory risk observations.",
    "- client_disclaimer (string): note that past performance does not guarantee future results.",
    "Return only the JSON object.",
  ].join("\n");
}
