"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTrader, requireUserId } from "@/lib/auth/dal";
import {
  ALLOWED_MIME,
  MAX_EVIDENCE_BYTES,
  saveEvidenceFile,
  deleteEvidenceFile,
} from "@/lib/evidence";
import { publicCopyError, publicCopyIssues } from "@/lib/public-copy";
import { postLanguageIssues } from "@/lib/posts";
import { parseTraderDetails } from "@/lib/profile-details";
import { pickKeys } from "@/lib/profile-options";
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
  const v = raw.trim().slice(0, 300);
  if (!v) return null;
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^[^\s/]+\.[^\s/]+/.test(v)) return `https://${v}`;
  return null;
}

/**
 * Public profile copy must pass the banned-language filter *and* the
 * signal-language filter (no "join my paid group" in a bio or services line).
 */
function profileCopyError(values: Array<string | null | undefined>): string | null {
  const text = values.filter(Boolean).join("\n");
  const issues = [...new Set([...publicCopyIssues([text]), ...postLanguageIssues(text)])];
  return publicCopyError(issues);
}

/** Refresh every surface that renders the trader's public identity. */
function revalidateTraderSurfaces(slug: string) {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/explore");
  revalidatePath(`/p/${slug}`);
}

/** Save privacy settings: visibility, redaction, cadence and disclaimer. */
export async function savePortalSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { id: userId, profile } = await requireTrader();
  const isPublic = formData.get("isPublic") === "on";
  const hideAmounts = formData.get("hideAmounts") === "on";
  const hideBrokers = formData.get("hideBrokers") === "on";
  const disclaimer = String(formData.get("disclaimer") ?? "").trim().slice(0, 1000);

  const complianceMessage = profileCopyError([disclaimer]);
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
    },
  });
  revalidateTraderSurfaces(profile.slug);
  return { saved: true };
}

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const traderProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { error: "Display name is required." })
    .max(80, { error: "Keep the display name under 80 characters." }),
  headline: optionalText(140),
  bio: optionalText(500),
  strategy: optionalText(500),
  instruments: optionalText(200),
  riskRules: optionalText(500),
});

export type TraderProfileState =
  | {
      saved?: boolean;
      error?: string;
      errors?: Partial<Record<keyof z.infer<typeof traderProfileSchema>, string[]>>;
    }
  | undefined;

/**
 * Save the trader's public identity: name, headline, free-text notes, and the
 * structured fields (markets, strategy tags, region, capital band, experience,
 * self-declared credentials + registration). The handle (slug) is not editable here.
 */
export async function saveTraderProfile(
  _prev: TraderProfileState,
  formData: FormData,
): Promise<TraderProfileState> {
  const { id: userId, profile } = await requireTrader();

  const parsed = traderProfileSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    headline: formData.get("headline") ?? "",
    bio: formData.get("bio") ?? "",
    strategy: formData.get("strategy") ?? "",
    instruments: formData.get("instruments") ?? "",
    riskRules: formData.get("riskRules") ?? "",
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, error: "Check the highlighted fields." };
  }
  const details = parseTraderDetails(formData);
  if (details.error) return { error: details.error };

  const { displayName, headline, bio, strategy, instruments, riskRules } = parsed.data;
  const complianceMessage = profileCopyError([
    displayName,
    headline,
    bio,
    strategy,
    instruments,
    riskRules,
    details.data.credentials,
    details.data.registrationNumber,
  ]);
  if (complianceMessage) return { error: complianceMessage };

  await prisma.traderProfile.update({
    where: { userId },
    data: {
      displayName,
      headline: headline || null,
      bio: bio || null,
      strategy: strategy || null,
      instruments: instruments || null,
      riskRules: riskRules || null,
      ...details.data,
    },
  });
  revalidateTraderSurfaces(profile.slug);
  return { saved: true };
}

/**
 * Availability: whether clients may request a conversation, what the trader
 * offers, and an optional contact link. The legacy `openToWork` flag mirrors
 * `acceptInquiries` so older surfaces stay consistent.
 */
export async function saveAvailability(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { id: userId, profile } = await requireTrader();
  const acceptInquiries = formData.get("acceptInquiries") === "on";
  const services = String(formData.get("services") ?? "").trim().slice(0, 600);
  const rawContact = String(formData.get("contactUrl") ?? "");
  const contactUrl = normalizeContactUrl(rawContact);
  if (rawContact.trim() && !contactUrl) {
    return { error: "Use an email address or an http(s) link for the contact link." };
  }

  const complianceMessage = profileCopyError([services, contactUrl]);
  if (complianceMessage) return { error: complianceMessage };

  await prisma.traderProfile.update({
    where: { userId },
    data: {
      acceptInquiries,
      openToWork: acceptInquiries,
      services: services || null,
      contactUrl,
    },
  });
  revalidateTraderSurfaces(profile.slug);
  return { saved: true };
}

/** Section-level privacy: which public-profile sections are hidden. */
export async function saveSectionPrivacy(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { id: userId, profile } = await requireTrader();
  const hiddenSections = pickKeys("sections", formData.getAll("hiddenSections"));
  await prisma.traderProfile.update({ where: { userId }, data: { hiddenSections } });
  revalidateTraderSurfaces(profile.slug);
  return { saved: true };
}

const nameSchema = z
  .string()
  .trim()
  .min(2, { error: "Name must be at least 2 characters." })
  .max(80, { error: "Keep your name under 80 characters." });

/** Account basics (any role): the name shown on follows, requests and messages. */
export async function saveAccountBasics(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const userId = await requireUserId();
  const parsed = nameSchema.safeParse(formData.get("name") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter your name." };
  const complianceMessage = profileCopyError([parsed.data]);
  if (complianceMessage) return { error: complianceMessage };

  await prisma.user.update({ where: { id: userId }, data: { name: parsed.data } });
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

/** Upload an evidence file (statement, payout proof, export). Traders only. */
export async function uploadEvidence(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { id: userId } = await requireTrader();
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
  const label = String(formData.get("label") ?? "").trim().slice(0, 120) || null;

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
      originalName: file.name.slice(0, 200),
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
  const { id: userId, profile } = await requireTrader();
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
    revalidatePath(`/p/${profile.slug}`);
  }
}

export async function deleteEvidence(formData: FormData) {
  const { id: userId, profile } = await requireTrader();
  const id = String(formData.get("id") ?? "");
  const evidence = await prisma.evidence.findFirst({ where: { id, userId }, select: { id: true } });
  if (evidence) {
    await prisma.evidence.delete({ where: { id } });
    await deleteEvidenceFile(id);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath(`/p/${profile.slug}`);
  }
}

/**
 * Wipe loaded trades + daily rollup for one account, keeping the account
 * itself (and its reports/evidence). For undoing a wrong source-history load.
 */
export async function clearAccountTrades(formData: FormData) {
  const { id: userId } = await requireTrader();
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
  const { id: userId } = await requireTrader();
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
  const { id: userId } = await requireTrader();
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
