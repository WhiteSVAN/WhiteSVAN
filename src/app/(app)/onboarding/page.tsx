import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.profile) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Set up your research profile
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        This is your TrustSVAN identity for research rooms, public profiles, and the researcher directory.
      </p>
      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm">
        <OnboardingForm defaultName={user.name ?? ""} />
      </div>
    </div>
  );
}
