"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/dal";
import {
  ALLOWED_MIME,
  MAX_EVIDENCE_BYTES,
  saveEvidenceFile,
  deleteEvidenceFile,
} from "@/lib/evidence";

export type SettingsState = { saved?: boolean; error?: string } | undefined;

const CADENCES = ["DAILY", "WEEKLY", "MONTHLY", "MANUAL"] as const;
type Cadence = (typeof CADENCES)[number];

/** Save portal settings: visibility, dollar-amount redaction, cadence, and disclaimer. */
export async function savePortalSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const userId = await requireUserId();
  const isPublic = formData.get("isPublic") === "on";
  const hideAmounts = formData.get("hideAmounts") === "on";
  const hideBrokers = formData.get("hideBrokers") === "on";
  const disclaimer = String(formData.get("disclaimer") ?? "").trim();

  const cadenceRaw = String(formData.get("updateCadence") ?? "MANUAL");
  const updateCadence: Cadence = (CADENCES as readonly string[]).includes(cadenceRaw)
    ? (cadenceRaw as Cadence)
    : "MANUAL";

  await prisma.traderProfile.update({
    where: { userId },
    data: { isPublic, hideAmounts, hideBrokers, updateCadence, disclaimer: disclaimer || null },
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { saved: true };
}

const EVIDENCE_KINDS = ["STATEMENT", "PAYOUT", "EXPORT", "OTHER"] as const;

/** Upload an evidence file (statement, payout proof, export). */
export async function uploadEvidence(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const userId = await requireUserId();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_EVIDENCE_BYTES) return { error: "File too large (max 10 MB)." };
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: "Unsupported type. Use PDF, image, CSV, or text." };
  }

  const kindRaw = String(formData.get("kind") ?? "OTHER");
  const kind = (EVIDENCE_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as (typeof EVIDENCE_KINDS)[number])
    : "OTHER";
  const label = String(formData.get("label") ?? "").trim() || null;

  // Optional account scoping — verify ownership if provided.
  let accountId = String(formData.get("accountId") ?? "") || null;
  if (accountId) {
    const owned = await prisma.tradingAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!owned) accountId = null;
  }

  const evidence = await prisma.evidence.create({
    data: {
      userId,
      accountId,
      kind,
      label,
      originalName: file.name,
      mime: file.type,
      size: file.size,
    },
    select: { id: true },
  });
  await saveEvidenceFile(evidence.id, Buffer.from(await file.arrayBuffer()));

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { saved: true };
}

export async function toggleEvidencePublic(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const evidence = await prisma.evidence.findFirst({
    where: { id, userId },
    select: { id: true, isPublic: true },
  });
  if (evidence) {
    await prisma.evidence.update({ where: { id }, data: { isPublic: !evidence.isPublic } });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
  }
}

export async function deleteEvidence(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const evidence = await prisma.evidence.findFirst({ where: { id, userId }, select: { id: true } });
  if (evidence) {
    await prisma.evidence.delete({ where: { id } });
    await deleteEvidenceFile(id);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
  }
}

/**
 * Wipe imported trades + daily rollup for one account, keeping the account
 * itself (and its reports/evidence). For undoing a wrong-CSV import.
 */
export async function clearAccountTrades(formData: FormData) {
  const userId = await requireUserId();
  const accountId = String(formData.get("accountId") ?? "");
  const owned = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!owned) return;

  await prisma.$transaction([
    prisma.trade.deleteMany({ where: { accountId } }),
    prisma.dailyPnl.deleteMany({ where: { accountId } }),
  ]);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

/**
 * Delete a trading account entirely. Cascades trades, daily rollup, and reports;
 * evidence is unlinked (SetNull) so uploaded statements are kept in the locker.
 */
export async function deleteAccount(formData: FormData) {
  const userId = await requireUserId();
  const accountId = String(formData.get("accountId") ?? "");
  const owned = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!owned) return;

  await prisma.tradingAccount.delete({ where: { id: accountId } });
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

/**
 * Clear ALL imported trades + daily rollups across every account, keeping the
 * accounts (and reports/evidence) intact — a "reset my numbers" without losing
 * account setup. A full account purge is per-account via deleteAccount.
 */
export async function clearAllData() {
  const userId = await requireUserId();
  const accounts = await prisma.tradingAccount.findMany({
    where: { userId },
    select: { id: true },
  });
  const ids = accounts.map((a) => a.id);
  if (ids.length === 0) return;

  await prisma.$transaction([
    prisma.trade.deleteMany({ where: { accountId: { in: ids } } }),
    prisma.dailyPnl.deleteMany({ where: { accountId: { in: ids } } }),
  ]);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}
