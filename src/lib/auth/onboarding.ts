/**
 * A new account's role and referral code (server only). Google sign-ups carry them in short-lived
 * cookies set before the trip to Google; the onboarding role picker submits the role itself.
 * Call these from a Server Action or Route Handler, where cookies can be cleared.
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const SIGNUP_ROLE_COOKIE = "signup_role";
export const SIGNUP_REF_COOKIE = "signup_ref";

export type SignupRole = "TRADER" | "CLIENT";

/** The role the sign-up page asked for before a Google sign-in, if any. */
export async function pendingSignupRole(): Promise<SignupRole | null> {
  const role = (await cookies()).get(SIGNUP_ROLE_COOKIE)?.value;
  return role === "TRADER" || role === "CLIENT" ? role : null;
}

export async function clearSignupCookies(): Promise<void> {
  const store = await cookies();
  store.delete(SIGNUP_ROLE_COOKIE);
  store.delete(SIGNUP_REF_COOKIE);
}

/** Give a user without a role this one (a role never changes), record a pending referral, and clear the cookies. */
export async function applySignupRole(userId: string, role: SignupRole): Promise<void> {
  const ref = (await cookies()).get(SIGNUP_REF_COOKIE)?.value?.toLowerCase() ?? "";
  const referrer = /^[a-z0-9]{6,16}$/.test(ref)
    ? await prisma.user.findUnique({ where: { referralCode: ref }, select: { id: true } })
    : null;

  await prisma.user.updateMany({ where: { id: userId, role: null }, data: { role } });
  if (referrer && referrer.id !== userId) {
    await prisma.user.updateMany({ where: { id: userId, referredById: null }, data: { referredById: referrer.id } });
  }
  await clearSignupCookies();
}
