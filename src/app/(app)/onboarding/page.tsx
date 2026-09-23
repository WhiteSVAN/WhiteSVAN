import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.profile) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-xl">
      <p className="terminal-label">Identity / 01</p>
      <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-900">
        Set up your research profile
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        This is your TrustSVAN identity for research rooms, public profiles, and the researcher directory.
      </p>
      <div className="terminal-card mt-6 p-6">
        <OnboardingForm defaultName={user.name ?? ""} />
      </div>
    </div>
  );
}
