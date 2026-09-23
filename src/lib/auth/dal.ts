/**
 * Data Access Layer for auth — the real authorization boundary.
 *
 * Per the Next.js auth guide, route protection lives here (called from
 * layouts / pages / Server Actions), not only in `proxy.ts`. `cache` dedupes
 * the session read within a single render pass.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Session user id, or redirect to /login. Use to gate any protected work. */
export const requireUserId = cache(async (): Promise<string> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
});

/** Signed-in user with their trader profile (or redirect). */
export const requireUser = cache(async () => {
  const id = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clientProfile: { select: { id: true } },
      profile: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          isPublic: true,
          updateCadence: true,
          lastPublishedAt: true,
        },
      },
    },
  });
  if (!user) redirect("/login");
  return user;
});

/** Signed-in user who has finished onboarding (role chosen + profile created). */
export const requireOnboardedUser = cache(async () => {
  const user = await requireUser();
  if (!user.role) redirect("/onboarding");
  if (user.role === "TRADER" && !user.profile) redirect("/onboarding");
  if (user.role === "CLIENT" && !user.clientProfile) redirect("/onboarding");
  return user;
});

/** Signed-in trader with a profile, or redirect (clients go to their home). */
export const requireTrader = cache(async () => {
  const user = await requireOnboardedUser();
  if (user.role !== "TRADER" || !user.profile) redirect("/dashboard");
  return { ...user, profile: user.profile };
});

/** Session user id or null — for public pages that adapt when signed in. */
export async function optionalUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
