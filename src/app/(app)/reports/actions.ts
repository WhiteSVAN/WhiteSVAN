"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTrader } from "@/lib/auth/dal";
import { computeTrustMetrics } from "@/lib/trust";
import { toISODate } from "@/lib/format";
import { generateAiReport } from "@/lib/ai/report";
import { reportComplianceIssues } from "@/lib/ai/compliance";
import { type AiReport } from "@/lib/ai/schema";
import { MissingApiKeyError } from "@/lib/ai/errors";

export type GenerateState = { message?: string } | undefined;

/** Generate a draft AI brief for one account + month, then open the editor. */
export async function generateReport(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const { id: userId } = await requireTrader();
  const accountId = String(formData.get("accountId") ?? "");
  const period = String(formData.get("period") ?? "");

  if (!/^\d{4}-\d{2}$/.test(period)) return { message: "Pick a month." };

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true, accountName: true, startingBalance: true },
  });
  if (!account) return { message: "Account not found." };

  const start = new Date(`${period}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const days = await prisma.dailyPnl.findMany({
    where: { accountId: account.id, tradeDate: { gte: start, lt: end } },
    select: { tradeDate: true, netPnl: true },
    orderBy: { tradeDate: "asc" },
  });
  if (days.length === 0) return { message: "No trades found in that month." };

  const dailySeries = days.map((d) => ({ date: toISODate(d.tradeDate), netPnl: Number(d.netPnl) }));
  const trust = computeTrustMetrics(dailySeries, Number(account.startingBalance), 2);
  const profile = await prisma.traderProfile.findUnique({
    where: { userId },
    select: { strategy: true, instruments: true, riskRules: true },
  });

  let ai: AiReport;
  try {
    ai = await generateAiReport({
      period,
      accountName: account.accountName,
      startingBalance: Number(account.startingBalance),
      metrics: trust.metrics,
      notes: {
        strategy: profile?.strategy,
        instruments: profile?.instruments,
        riskRules: profile?.riskRules,
      },
      signals: {
        bestDayShare: trust.bestDayShare,
        drawdownSeverity: trust.drawdownSeverity,
        badToGoodRatio: trust.badToGoodRatio,
        bounceBackDays: trust.bounceBackDays,
      },
    });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return { message: `Set the ${err.provider} API key in .env to generate briefs.` };
    }
    return { message: "Brief generation failed. Please try again." };
  }

  // Persist a code-of-record metrics snapshot alongside the AI text.
  const report = await prisma.report.create({
    data: {
      userId,
      accountId: account.id,
      period,
      // Round-trip through JSON so the snapshot is a plain value Prisma accepts.
      metrics: JSON.parse(
        JSON.stringify({
          ...trust.metrics,
          drawdownSeverity: trust.drawdownSeverity,
          bestDayShare: trust.bestDayShare,
        }),
      ),
      aiReport: ai,
      status: "DRAFT",
    },
    select: { id: true },
  });

  redirect(`/reports/${report.id}`);
}

export type ReportEditState =
  | { saved?: boolean; approved?: boolean; published?: boolean; issues?: string[]; message?: string }
  | undefined;

function splitLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function reportFromForm(formData: FormData): AiReport {
  return {
    executive_summary: String(formData.get("executive_summary") ?? "").trim(),
    performance_summary: String(formData.get("performance_summary") ?? "").trim(),
    risk_summary: String(formData.get("risk_summary") ?? "").trim(),
    discipline_review: String(formData.get("discipline_review") ?? "").trim(),
    client_disclaimer: String(formData.get("client_disclaimer") ?? "").trim(),
    notable_days: splitLines(formData.get("notable_days")),
    warnings: splitLines(formData.get("warnings")),
  };
}

/** Save edits (draft) or publish. Publishing is blocked by the compliance filter. */
export async function submitReport(
  _prev: ReportEditState,
  formData: FormData,
): Promise<ReportEditState> {
  const { id: userId } = await requireTrader();
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "save");

  const report = await prisma.report.findFirst({
    where: { id, userId },
    select: { id: true, status: true },
  });
  if (!report) return { message: "Brief not found." };
  if (report.status === "PUBLISHED" && intent !== "publish") {
    return { message: "Published briefs are read-only. Delete and regenerate if you need a replacement." };
  }

  const aiReport = reportFromForm(formData);

  if (intent === "approve") {
    const issues = reportComplianceIssues(aiReport);
    if (issues.length > 0) {
      await prisma.report.update({ where: { id }, data: { aiReport } });
      return { issues };
    }
    await prisma.report.update({ where: { id }, data: { aiReport, status: "APPROVED" } });
    return { approved: true };
  }

  if (intent === "publish") {
    if (report.status !== "APPROVED") {
      return { message: "Approve the brief before publishing." };
    }
    const issues = reportComplianceIssues(aiReport);
    if (issues.length > 0) {
      await prisma.report.update({ where: { id }, data: { aiReport } }); // keep edits, stay draft
      return { issues };
    }
    await prisma.report.update({ where: { id }, data: { aiReport, status: "PUBLISHED" } });
    return { published: true };
  }

  await prisma.report.update({
    where: { id },
    data: { aiReport, ...(report.status === "APPROVED" ? { status: "DRAFT" as const } : {}) },
  });
  return { saved: true };
}

export async function deleteReport(formData: FormData) {
  const { id: userId } = await requireTrader();
  const id = String(formData.get("id") ?? "");
  await prisma.report.deleteMany({ where: { id, userId } });
  redirect("/reports");
}
