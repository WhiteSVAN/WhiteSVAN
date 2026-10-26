import Link from "next/link";
import { googleEnabled } from "@/auth";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { StartSteps } from "@/components/prop-firm/start-steps";
import { findEvaluationPlan, formatInr } from "@/lib/prop-firm";
import { safeNextPath } from "@/lib/safe-path";
import { SignupForm } from "./signup-form";

/** Step 1 of 3 on its own, for links that only create an account. Checkout does this step itself. */
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
      <h1 className="text-3xl">Create your account</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">An email and a password. Then you choose your size and check out.</p>
      <div className="mt-5"><StartSteps done={0} /></div>

      {plan && (
        <p className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--card-deep)] px-4 py-3 text-sm">
          {plan.label} evaluation · {formatInr(plan.fee)} one-time <span className="text-[var(--muted)]">· you can change the size at checkout</span>
        </p>
      )}

      {googleEnabled && (
        <div className="mt-6">
          <GoogleButton role="TRADER" referral={referral} next={continueTo ?? "/checkout"} />
          <AuthDivider />
        </div>
      )}

      <div className={googleEnabled ? "" : "mt-6"}>
        <SignupForm referral={referral} plan={plan?.id} next={next} />
      </div>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href={continueTo ? `/login?${new URLSearchParams({ next: continueTo })}` : "/login"} className="font-medium text-[var(--foreground)] underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
