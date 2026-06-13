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

/** Save portal settings: visibility, dollar-amount redaction, and disclaimer. */
export async function savePortalSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const userId = await requireUserId();
  const isPublic = formData.get("isPublic") === "on";
  const hideAmounts = formData.get("hideAmounts") === "on";
  const disclaimer = String(formData.get("disclaimer") ?? "").trim();

  await prisma.traderProfile.update({
    where: { userId },
    data: { isPublic, hideAmounts, disclaimer: disclaimer || null },
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
