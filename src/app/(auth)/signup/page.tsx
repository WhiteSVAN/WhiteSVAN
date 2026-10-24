import Link from "next/link";
import { googleEnabled } from "@/auth";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { StartSteps } from "@/components/prop-firm/start-steps";
import { DEMO_CHECKOUT, DEMO_CREDIT } from "@/lib/checkout/demo";
import { findEvaluationPlan, formatInr } from "@/lib/prop-firm";
import { safeNextPath } from "@/lib/safe-path";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; ref?: string; plan?: string; next?: string }>;
}) {
  const sp = await searchParams;
  // Prop-firm sign-ups are traders; firms and allocators opt in to the client role.
  const asClient = sp.as === "client";
  const initialRole = asClient ? "CLIENT" : "TRADER";
  const referral = sp.ref?.slice(0, 16);
  const plan = !asClient && sp.plan ? findEvaluationPlan(sp.plan) : undefined;
  const next = safeNextPath(sp.next) ?? undefined;
  // Creating the account is step 1 of 3; checkout (step 2) is where the size is chosen.
  const continueTo = plan ? `/checkout/${plan.id}` : next;

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-100">{asClient ? "Create a client account" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {asClient
          ? "Discover traders and review their published records."
          : DEMO_CHECKOUT
            ? `Start your evaluation in three steps. New accounts get ${formatInr(DEMO_CREDIT)} of demo credit to pay with.`
            : "Get early access to WhiteSVAN evaluations, free Academy lessons and your trading journal."}
      </p>
      {!asClient && DEMO_CHECKOUT && <div className="mt-5"><StartSteps done={0} /></div>}

      {plan && (
        <div className="mt-5 rounded-lg border border-[#3a493d] bg-[#141c16] px-4 py-3">
          <p className="text-sm font-medium text-zinc-100">
            {plan.label} evaluation · {formatInr(plan.fee)} one-time
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">You can change the size at checkout, the next step.</p>
        </div>
      )}

      <SignupForm initialRole={initialRole} chooseRole={asClient} referral={referral} plan={plan?.id} next={next} />

      {googleEnabled && (
        <>
          <AuthDivider />
          <GoogleButton role={asClient ? undefined : "TRADER"} referral={referral} next={asClient ? undefined : (continueTo ?? "/checkout")} />
          {asClient && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              With Google you&apos;ll choose trader or client on the next screen.
            </p>
          )}
        </>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href={continueTo ? `/login?${new URLSearchParams({ next: continueTo })}` : "/login"} className="font-medium text-zinc-200 hover:text-zinc-100">
          Sign in
        </Link>
      </p>
      {!asClient && (
        <p className="mt-2 text-center text-xs text-zinc-500">
          Firm or allocator?{" "}
          <Link href="/signup?as=client" className="text-zinc-300 hover:text-zinc-100">
            Create a client account
          </Link>
        </p>
      )}
    </div>
  );
}
