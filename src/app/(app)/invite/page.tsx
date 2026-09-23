import type { Metadata } from "next";
import Link from "next/link";
import { requireTrader } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { referralLink } from "@/lib/referral";
import { ensureReferralCode, requestOrigin } from "./referral-code";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Invite traders · TrustSVAN" };

export default async function InvitePage() {
  const user = await requireTrader();
  const [code, origin] = await Promise.all([ensureReferralCode(user.id), requestOrigin()]);
  const traderLink = referralLink(origin, code);
  const clientLink = `${traderLink}&as=client`;

  const [signups, traders, withRecord] = await Promise.all([
    prisma.user.count({ where: { referredById: user.id } }),
    prisma.user.count({ where: { referredById: user.id, role: "TRADER" } }),
    prisma.user.count({
      where: { referredById: user.id, profile: { is: { versions: { some: {} } } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="terminal-label">Growth / referral link</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-zinc-900">Invite traders</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Share your link with traders who should publish a source-linked record. Sign-ups through it
          are attributed to you.
        </p>
      </div>

      <section className="terminal-card space-y-5 p-5 sm:p-6">
        <CopyLink id="trader-invite" label="Trader invite link" value={traderLink} />
        <CopyLink id="client-invite" label="Client invite link (opens signup as a client)" value={clientLink} />
        <p className="text-xs text-zinc-500">
          Your code is <span className="font-mono text-zinc-300">{code}</span>. Referrals are for
          attribution only — TrustSVAN pays no referral fees and never shares performance economics.
        </p>
      </section>

      <section aria-labelledby="referral-stats" className="space-y-3">
        <h2 id="referral-stats" className="text-sm font-medium text-zinc-800">
          Your referrals
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Sign-ups referred" value={signups} hint="Accounts created with your link" />
          <Stat label="Traders" value={traders} hint="Of those, chose the trader role" />
          <Stat label="Published a record" value={withRecord} hint="Have at least one published version" />
        </div>
        {signups === 0 && (
          <p className="text-sm text-zinc-500">
            No sign-ups yet. Your public profile at{" "}
            <Link href={`/p/${user.profile.slug}`} className="font-mono text-zinc-300 hover:underline">
              /p/{user.profile.slug}
            </Link>{" "}
            is a good thing to share alongside the link.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="terminal-card p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 font-mono text-2xl text-white">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
