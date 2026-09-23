"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTrader } from "@/lib/auth/dal";

export type BalanceState = { error?: string; saved?: boolean } | undefined;

/**
 * Update an account's starting balance. The equity curve, return %, and
 * drawdown % are all relative to this, so a correct value matters — especially
 * for the Biggest Drop severity shown to clients.
 */
export async function setStartingBalance(
  _prev: BalanceState,
  formData: FormData,
): Promise<BalanceState> {
  const { id: userId } = await requireTrader();
  const accountId = String(formData.get("accountId") ?? "");
  const value = Number(formData.get("startingBalance"));

  if (!Number.isFinite(value) || value < 0) return { error: "Enter a valid amount." };

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) return { error: "Account not found." };

  await prisma.tradingAccount.update({
    where: { id: accountId },
    data: { startingBalance: value },
  });
  revalidatePath("/dashboard");
  return { saved: true };
}

export type VisibilityState = { isPublic?: boolean } | undefined;

/** Toggle the trader's public portal (`/p/[slug]`) on or off. */
export async function setPortalVisibility(
  _prev: VisibilityState,
  formData: FormData,
): Promise<VisibilityState> {
  const { id: userId, profile } = await requireTrader();
  const makePublic = formData.get("isPublic") === "true";
  await prisma.traderProfile.update({
    where: { userId },
    data: { isPublic: makePublic },
  });
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/explore");
  revalidatePath(`/p/${profile.slug}`);
  return { isPublic: makePublic };
}
