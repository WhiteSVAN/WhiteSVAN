"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/dal";
import { profileSchema, roleSchema, type ProfileInput } from "@/lib/auth/schemas";
import { publicCopyError, publicCopyIssues } from "@/lib/public-copy";
import { parseTraderDetails } from "@/lib/profile-details";
import { pickKey, pickKeys } from "@/lib/profile-options";

export type ProfileFormState =
  | { errors?: Partial<Record<keyof ProfileInput, string[]>>; message?: string }
  | undefined;

/**
 * Choose trader or client (users who signed in with Google, or pre-V1 accounts
 * without a profile). Also applies a pending referral code from the signup cookie.
 */
export async function chooseRole(formData: FormData) {
  const userId = await requireUserId();
  const parsed = roleSchema.safeParse(formData.get("role"));
  if (!parsed.success) redirect("/onboarding");

  const store = await cookies();
  const ref = store.get("signup_ref")?.value?.toLowerCase() ?? "";
  const referrer = /^[a-z0-9]{6,16}$/.test(ref)
    ? await prisma.user.findUnique({ where: { referralCode: ref }, select: { id: true } })
    : null;

  await prisma.user.updateMany({
    where: { id: userId, role: null },
    data: { role: parsed.data },
  });
  if (referrer && referrer.id !== userId) {
    await prisma.user.updateMany({
      where: { id: userId, referredById: null },
      data: { referredById: referrer.id },
    });
  }
  store.delete("signup_role");
  store.delete("signup_ref");
  redirect("/onboarding");
}

export type ClientFormState = { message?: string } | undefined;

/** Lightweight client onboarding: who they are and what they want to discover. */
export async function createClientProfile(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const userId = await requireUserId();
  const organization = String(formData.get("organization") ?? "").trim().slice(0, 120) || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const data = {
    organization,
    note,
    clientType: pickKey("clientTypes", formData.get("clientType")),
    markets: pickKeys("markets", formData.getAll("markets")),
    regions: pickKeys("regions", formData.getAll("regions")),
    strategyTags: pickKeys("strategyTags", formData.getAll("strategyTags")),
  };
  await prisma.clientProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  await prisma.user.updateMany({ where: { id: userId, role: null }, data: { role: "CLIENT" } });

  const next = String(formData.get("next") ?? "");
  redirect(next === "settings" ? "/settings?saved=1" : "/explore");
}

/** Create or update the signed-in user's trader profile, then open the dashboard. */
export async function createProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const userId = await requireUserId();

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    slug: formData.get("slug"),
    bio: formData.get("bio"),
    strategy: formData.get("strategy"),
    instruments: formData.get("instruments"),
    riskRules: formData.get("riskRules"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { displayName, slug, bio, strategy, instruments, riskRules } = parsed.data;
  const details = parseTraderDetails(formData);
  if (details.error) return { message: details.error };
  const complianceMessage = publicCopyError(
    publicCopyIssues([displayName, bio, strategy, instruments, riskRules, details.data.credentials]),
  );
  if (complianceMessage) return { message: complianceMessage };

  // Handle must be globally unique; allow the owner to keep their own.
  const taken = await prisma.traderProfile.findUnique({
    where: { slug },
    select: { userId: true },
  });
  if (taken && taken.userId !== userId) {
    return { errors: { slug: ["That handle is taken — try another."] } };
  }

  const data = {
    displayName,
    slug,
    bio: bio || null,
    strategy: strategy || null,
    instruments: instruments || null,
    riskRules: riskRules || null,
    ...details.data,
  };
  await prisma.traderProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  await prisma.user.updateMany({ where: { id: userId, role: null }, data: { role: "TRADER" } });

  redirect(formData.get("next") === "settings" ? "/settings?saved=1" : "/dashboard");
}

/** Clear the session and return to the sign-in screen. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
