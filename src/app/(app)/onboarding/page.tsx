import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.profile) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Set up your operator profile
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        This is your SVAN Capital identity for research rooms, operator cards, and the trader directory.
      </p>
      <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
        <OnboardingForm defaultName={user.name ?? ""} />
      </div>
    </div>
  );
}
