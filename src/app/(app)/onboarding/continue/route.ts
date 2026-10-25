import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { applySignupRole, clearSignupCookies, pendingSignupRole } from "@/lib/auth/onboarding";
import { safeNextPath } from "@/lib/safe-path";

/**
 * Where a Google sign-in lands (a full-page redirect, so this runs once). A new account becomes a
 * trader (or takes the role its sign-up asked for) and goes on to `next`, or checkout.
 */
export async function GET(request: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) redirect("/login");

  if (user.role) {
    await clearSignupCookies();
    redirect(next ?? "/dashboard");
  }
  await applySignupRole(userId, (await pendingSignupRole()) ?? "TRADER");
  redirect(next ?? "/checkout");
}
