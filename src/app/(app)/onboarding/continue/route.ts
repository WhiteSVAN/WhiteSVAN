import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { applySignupRole, clearSignupCookies, pendingSignupRole } from "@/lib/auth/onboarding";
import { safeNextPath } from "@/lib/safe-path";

/**
 * Where a Google sign-in lands. A new account takes the role its sign-up page asked for, so a
 * trader goes straight on to `next` (checkout, from the sign-up page) without the role picker or a
 * journal profile. A new account with no role asked for picks one on the onboarding page, and a
 * client without a client profile sets one up there.
 */
export async function GET(request: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, clientProfile: { select: { id: true } } } });
  if (!user) redirect("/login");

  let role = user.role;
  if (role) {
    await clearSignupCookies();
  } else {
    const pending = await pendingSignupRole();
    // Keep the cookies for the picker: it applies the referral code with the role.
    if (!pending) redirect(next ? `/onboarding?${new URLSearchParams({ next })}` : "/onboarding");
    await applySignupRole(userId, pending);
    role = pending;
  }
  if (role === "CLIENT" && !user.clientProfile) redirect("/onboarding");
  redirect(next ?? "/dashboard");
}
