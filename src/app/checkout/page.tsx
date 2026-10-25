import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RECOMMENDED_PLAN } from "@/lib/prop-firm";

/**
 * Where "Get funded" and "Start your evaluation" go. Signed out, creating the account comes first,
 * with no size to pick; signed in, checkout opens on the recommended size, which the trader can
 * change there.
 */
export default async function CheckoutStartPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/signup?${new URLSearchParams({ next: "/checkout" })}`);
  redirect(`/checkout/${RECOMMENDED_PLAN.id}`);
}
