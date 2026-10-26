"use server";

import { redirect } from "next/navigation";
import { tradingNow } from "@/lib/accounts/clock";
import { activateFundedAccount } from "@/lib/accounts/store";
import { requireMember } from "@/lib/auth/dal";

/** Open the funded account a pass was waiting on, then go to it; back to My accounts if it can't open yet. */
export async function activateFunded(formData: FormData): Promise<void> {
  const user = await requireMember();
  const outcome = await activateFundedAccount(user.id, String(formData.get("account") ?? ""), tradingNow());
  redirect(outcome && outcome !== "full" ? `/trade/${outcome.fundedId}` : "/dashboard");
}
