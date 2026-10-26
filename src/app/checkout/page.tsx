import { redirect } from "next/navigation";
import { RECOMMENDED_PLAN } from "@/lib/prop-firm";

/**
 * Where "Get funded" and "Start your evaluation" go: checkout on the recommended size, signed in
 * or not. Checkout creates the account itself, so there's no sign-up page in between.
 */
export default async function CheckoutStartPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const ref = (await searchParams).ref?.slice(0, 16);
  redirect(`/checkout/${RECOMMENDED_PLAN.id}${ref ? `?${new URLSearchParams({ ref })}` : ""}`);
}
