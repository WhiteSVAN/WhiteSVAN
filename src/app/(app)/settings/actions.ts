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
import { publicCopyError, publicCopyIssues } from "@/lib/public-copy";
import { EvidenceKind } from "@/generated/prisma/enums";

export type SettingsState = { saved?: boolean; error?: string } | undefined;

const CADENCES = ["DAILY", "WEEKLY", "MONTHLY", "MANUAL"] as const;
type Cadence = (typeof CADENCES)[number];

/**
 * Normalize a contact link to a safe, clickable URL. Accepts http(s)/mailto as
 * given; turns a bare email into `mailto:` and a bare domain into `https://`.
 * Returns null for empty input or anything that isn't a safe scheme (blocks
 * `javascript:` and friends).
 */
function normalizeContactUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^[^\s/]+\.[^\s/]+/.test(v)) return `https://${v}`;
  return null;
}

/** Save portal settings: visibility, redaction, cadence, disclaimer, and client-attraction fields. */
export async function savePortalSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const userId = await requireUserId();
  const isPublic = formData.get("isPublic") === "on";
  const hideAmounts = formData.get("hideAmounts") === "on";
  const hideBrokers = formData.get("hideBrokers") === "on";
  const disclaimer = String(formData.get("disclaimer") ?? "").trim();

  // Client-attraction fields — public-facing, so run the free text through the
  // same banned-language compliance filter as the disclaimer.
  const openToWork = formData.get("openToWork") === "on";
  const headline = String(formData.get("headline") ?? "").trim().slice(0, 140);
  const services = String(formData.get("services") ?? "").trim().slice(0, 600);
  const contactUrl = normalizeContactUrl(String(formData.get("contactUrl") ?? ""));

  const complianceMessage = publicCopyError(publicCopyIssues([disclaimer, headline, services]));
  if (complianceMessage) return { error: complianceMessage };

  const cadenceRaw = String(formData.get("updateCadence") ?? "MANUAL");
  const updateCadence: Cadence = (CADENCES as readonly string[]).includes(cadenceRaw)
    ? (cadenceRaw as Cadence)
    : "MANUAL";

  await prisma.traderProfile.update({
    where: { userId },
    data: {
      isPublic,
      hideAmounts,
      hideBrokers,
      updateCadence,
      disclaimer: disclaimer || null,
      openToWork,
      headline: headline || null,
      services: services || null,
      contactUrl,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { saved: true };
}

const EVIDENCE_KINDS = [
  EvidenceKind.STATEMENT,
  EvidenceKind.TAX_RETURN,
  EvidenceKind.PAYOUT,
  EvidenceKind.EXPORT,
  EvidenceKind.OTHER,
] as const;

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
    return { error: "Unsupported type. Use PDF, image, source export, or text." };
  }

  const kindRaw = String(formData.get("kind") ?? "OTHER");
  const kind = (EVIDENCE_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as (typeof EVIDENCE_KINDS)[number])
    : EvidenceKind.OTHER;
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
    select: { id: true, isPublic: true, kind: true },
  });
  if (evidence) {
    if (evidence.kind === EvidenceKind.TAX_RETURN) return;
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
 * Wipe loaded trades + daily rollup for one account, keeping the account
 * itself (and its reports/evidence). For undoing a wrong source-history load.
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
    prisma.importBatch.deleteMany({ where: { accountId } }),
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
 * Clear ALL loaded trades + daily rollups across every account, keeping the
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
    prisma.importBatch.deleteMany({ where: { accountId: { in: ids } } }),
    prisma.trade.deleteMany({ where: { accountId: { in: ids } } }),
    prisma.dailyPnl.deleteMany({ where: { accountId: { in: ids } } }),
  ]);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}
