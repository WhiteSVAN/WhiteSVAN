import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/dal";
import { RolePicker } from "@/components/auth/role-picker";
import { chooseRole } from "../actions";
import { OnboardingForm } from "./onboarding-form";
import { ClientOnboardingForm } from "./client-onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();

  if (!user.role) {
    const pending = (await cookies()).get("signup_role")?.value;
    return (
      <Shell step="01" title="How will you use TrustSVAN?" blurb="You can't switch roles later from the app, so pick the one that fits.">
        <form action={chooseRole} className="space-y-5">
          <RolePicker defaultRole={pending === "CLIENT" ? "CLIENT" : pending === "TRADER" ? "TRADER" : undefined} />
          <button type="submit" className="flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-medium text-zinc-950 hover:bg-white">
            Continue
          </button>
        </form>
      </Shell>
    );
  }

  if (user.role === "TRADER") {
    if (user.profile) redirect("/dashboard");
    return (
      <Shell step="02" title="Set up your trader profile" blurb="Your public identity for your record, posts, and the trader directory. Structured fields power discovery filters.">
        <OnboardingForm defaultName={user.name ?? ""} />
      </Shell>
    );
  }

  if (user.clientProfile) redirect("/dashboard");
  return (
    <Shell step="02" title="What are you looking for?" blurb="This tunes your discovery defaults. It's private — traders don't see it.">
      <ClientOnboardingForm />
    </Shell>
  );
}

function Shell({ step, title, blurb, children }: { step: string; title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="terminal-label">Identity / {step}</p>
      <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-900">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{blurb}</p>
      <div className="terminal-card mt-6 p-6">{children}</div>
    </div>
  );
}
