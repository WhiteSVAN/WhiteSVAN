"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth/dal";
import { profileSchema, type ProfileInput } from "@/lib/auth/schemas";

export type ProfileFormState =
  | { errors?: Partial<Record<keyof ProfileInput, string[]>>; message?: string }
  | undefined;

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
  };
  await prisma.traderProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  redirect("/dashboard");
}

/** Clear the session and return to the sign-in screen. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
