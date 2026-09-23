/**
 * Client settings: private discovery preferences (reusing the client onboarding
 * form, which saves via createClientProfile and returns to /settings?saved=1)
 * plus account basics. Scoped to the session user resolved by the page.
 */
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { ClientOnboardingForm } from "../onboarding/client-onboarding-form";
import { AccountBasicsForm } from "./account-basics-form";

export async function ClientSettings({ userId, saved }: { userId: string; saved: boolean }) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      createdAt: true,
      clientProfile: {
        select: {
          organization: true,
          clientType: true,
          markets: true,
          regions: true,
          strategyTags: true,
          note: true,
        },
      },
    },
  });
  const prefs = user.clientProfile;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="terminal-label">Client controls / private by default</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-900">Settings</h1>
      </div>

      {saved && (
        <p className="rounded-lg border border-[#57733a] bg-[#1a2418] px-4 py-2 text-sm text-[#dff5c4]" role="status">
          Preferences saved. Your home and the trader directory now use them.
        </p>
      )}

      <section id="preferences" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Discovery preferences</h2>
        <p className="mt-1 text-sm text-zinc-500">
          What you&apos;re looking for. Private — traders never see it. It tunes &ldquo;Matching your
          preferences&rdquo; on your home and the default filters in Traders.
        </p>
        <div className="mt-4">
          <ClientOnboardingForm
            next="settings"
            defaults={{
              organization: prefs?.organization ?? null,
              clientType: prefs?.clientType ?? null,
              markets: prefs?.markets ?? [],
              regions: prefs?.regions ?? [],
              strategyTags: prefs?.strategyTags ?? [],
              note: prefs?.note ?? null,
            }}
          />
        </div>
      </section>

      <section id="account" className="terminal-card scroll-mt-28 p-6">
        <h2 className="text-base font-medium text-zinc-800">Account</h2>
        <div className="mt-4">
          <AccountBasicsForm
            name={user.name ?? ""}
            email={user.email}
            roleLabel="Client"
            memberSince={format(user.createdAt, "MMM yyyy")}
          />
        </div>
      </section>
    </div>
  );
}
