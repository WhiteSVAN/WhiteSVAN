import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.profile) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Set up your trader profile
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        This is the client-facing identity for your portal. You can change it later in settings.
      </p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <OnboardingForm defaultName={user.name ?? ""} />
      </div>
    </div>
  );
}
