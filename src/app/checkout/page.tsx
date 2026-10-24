import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startingPlan } from "@/lib/checkout/billing";
import { checkoutModeFor } from "@/lib/checkout/config";
import { demoCreditLeft } from "@/lib/checkout/demo";

/**
 * Where "Get funded" and "Start your evaluation" go. Signed out, creating the account comes first,
 * with no size to pick; signed in, checkout opens on a starting size the trader can change there.
 */
export default async function CheckoutStartPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/signup?${new URLSearchParams({ next: "/checkout" })}`);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, demoCreditSpent: true } });
  const credit = user && checkoutModeFor(user.email) === "demo" ? demoCreditLeft(user.demoCreditSpent) : null;
  redirect(`/checkout/${startingPlan(credit).id}`);
}
