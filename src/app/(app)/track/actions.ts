"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/dal";
import { parseZerodhaTradebook } from "@/lib/csv/brokers";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/hash";
import { DuplicateImportError, OverlappingImportError, importTrades } from "@/lib/ingest/import";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { isProgrammeContract, MAX_TRADEBOOK_BYTES } from "@/lib/track-record";

export type TrackFormState = { message?: string } | undefined;

/**
 * Start a track record, or start over: each trader has one, judged against one evaluation plan
 * from a start date. Starting over keeps the synced trades and moves the start date, so only
 * trades from then on count.
 */
export async function startTracking(_prev: TrackFormState, formData: FormData): Promise<TrackFormState> {
  const user = await requireMember();
  const plan = findEvaluationPlan(String(formData.get("plan") ?? ""));
  if (!plan) return { message: "Choose an account size." };
  const start = String(formData.get("start") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(start))) return { message: "Choose the first day to count." };
  const track = { trackPlanId: plan.id, trackStart: new Date(`${start}T00:00:00Z`), startingBalance: plan.balance };

  const existing = await prisma.tradingAccount.findFirst({
    where: { userId: user.id, trackPlanId: { not: null } },
    select: { id: true },
  });
  if (existing) {
    await prisma.tradingAccount.update({ where: { id: existing.id }, data: { ...track, accountName: `Zerodha track record · ${plan.label}` } });
  } else {
    await prisma.tradingAccount.create({
      data: { userId: user.id, accountName: `Zerodha track record · ${plan.label}`, broker: "Zerodha", currency: "INR", ...track },
    });
  }
  redirect("/track");
}

/**
 * Sync a Zerodha Console tradebook into the trader's track record. The server parses the file
 * itself, keeps only NIFTY, BANK NIFTY and SENSEX futures and options, and writes through the
 * shared import core, which rebuilds the daily results.
 */
export async function syncTradebook(_prev: TrackFormState, formData: FormData): Promise<TrackFormState> {
  const user = await requireMember();
  const account = await prisma.tradingAccount.findFirst({
    where: { userId: user.id, trackPlanId: { not: null } },
    select: { id: true },
  });
  if (!account) return { message: "Start your track record first." };

  const file = formData.get("tradebook");
  if (!(file instanceof File) || file.size === 0) return { message: "Choose your tradebook CSV." };
  if (file.size > MAX_TRADEBOOK_BYTES) return { message: "That file is too large. Export a shorter date range." };
  const text = await file.text();

  const parsed = parseZerodhaTradebook(text, { include: isProgrammeContract });
  if (parsed.trades.length === 0) {
    return { message: parsed.errors.find((error) => error.row === 0)?.message ?? "No closed NIFTY, BANK NIFTY or SENSEX trades in this file." };
  }

  try {
    await importTrades(account.id, parsed.trades, {
      source: "CSV",
      broker: "Zerodha",
      originalFilename: file.name || null,
      fileHash: sha256(text),
      openPositions: parsed.openPositions,
    });
  } catch (error) {
    if (error instanceof DuplicateImportError) return { message: "You've already synced this file." };
    if (error instanceof OverlappingImportError) {
      return { message: `This file overlaps days you've already synced (${error.periodStart} to ${error.periodEnd}). Export only the days after them.` };
    }
    throw error;
  }
  redirect(`/track?synced=${parsed.trades.length}`);
}
