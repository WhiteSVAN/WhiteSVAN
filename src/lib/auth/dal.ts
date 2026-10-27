/**
 * Data Access Layer for auth — the real authorization boundary.
 *
 * Per the Next.js auth guide, route protection lives here (called from
 * layouts / pages / Server Actions), not only in `proxy.ts`. `cache` dedupes
 * the session read within a single render pass.
 */
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
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

/**
 * Signed-in member for the prop-firm workspace (My accounts, checkout, payouts); no journal profile
 * is needed. A user still without a role becomes a trader here, in place: a redirect to the
 * /onboarding/continue route would run that route twice during a client navigation.
 */
export const requireMember = cache(async () => {
  const user = await requireUser();
  if (user.role) return user;
  await prisma.user.updateMany({ where: { id: user.id, role: null }, data: { role: "TRADER" } });
  return { ...user, role: "TRADER" as const };
});

/** Signed-in trader with a profile, or redirect (clients go to their home). */
export const requireTrader = cache(async () => {
  const user = await requireOnboardedUser();
  if (user.role !== "TRADER" || !user.profile) redirect("/dashboard");
  return { ...user, profile: user.profile };
});

/**
 * A signed-in admin (User.isAdmin, granted only from the command line: npm run db:admin), for the
 * admin portal. Signed out goes to sign-in and back to the portal's overview (the layout checks
 * first, so the overview, not the page asked for); anyone else gets a 404, so the portal doesn't
 * reveal itself. The flag is read on every request, not kept in the session, so a revoke is at once.
 */
export const requireAdmin = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Fadmin");
  const admin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, isAdmin: true } });
  if (!admin?.isAdmin) notFound();
  return admin;
});

/** Session user id or null — for public pages that adapt when signed in. */
export async function optionalUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
