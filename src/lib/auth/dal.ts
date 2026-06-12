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
      profile: { select: { id: true, slug: true, displayName: true } },
    },
  });
  if (!user) redirect("/login");
  return user;
});
