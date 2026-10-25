import Link from "next/link";
import { googleEnabled } from "@/auth";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { StartSteps } from "@/components/prop-firm/start-steps";
import { DEMO_CHECKOUT, DEMO_CREDIT } from "@/lib/checkout/demo";
import { findEvaluationPlan, formatInr } from "@/lib/prop-firm";
import { safeNextPath } from "@/lib/safe-path";
import { SignupForm } from "./signup-form";

/** Step 1 of 3: create the account. No size to pick here; that's step 2, at checkout. */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; plan?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const referral = sp.ref?.slice(0, 16);
  const plan = sp.plan ? findEvaluationPlan(sp.plan) : undefined;
  const next = safeNextPath(sp.next) ?? undefined;
  const continueTo = next ?? (plan ? `/checkout/${plan.id}` : undefined);

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-100">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {DEMO_CHECKOUT ? `New accounts get ${formatInr(DEMO_CREDIT)} of demo credit to pay with.` : "Evaluations open at launch."}
      </p>
      {DEMO_CHECKOUT && <div className="mt-5"><StartSteps done={0} /></div>}

      {plan && (
        <div className="mt-5 rounded-lg border border-[#3a493d] bg-[#141c16] px-4 py-3">
          <p className="text-sm font-medium text-zinc-100">
            {plan.label} evaluation · {formatInr(plan.fee)} one-time
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">You can change the size at checkout, the next step.</p>
        </div>
      )}

      <SignupForm referral={referral} plan={plan?.id} next={next} />

      {googleEnabled && (
        <>
          <AuthDivider />
          <GoogleButton role="TRADER" referral={referral} next={continueTo ?? "/checkout"} />
        </>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href={continueTo ? `/login?${new URLSearchParams({ next: continueTo })}` : "/login"} className="font-medium text-zinc-200 hover:text-zinc-100">
          Sign in
        </Link>
      </p>
    </div>
  );
}
