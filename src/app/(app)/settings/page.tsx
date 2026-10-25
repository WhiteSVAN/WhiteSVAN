import type { Metadata } from "next";
import { format } from "date-fns";
import { requireMember } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { AccountBasicsForm } from "./account-basics-form";

export const metadata: Metadata = { title: "Settings · WhiteSVAN" };

/** Your name (for receipts and emails) and your sign-in email. */
export default async function SettingsPage() {
  const user = await requireMember();
  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, createdAt: true } });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl font-medium tracking-[-0.04em]">Settings</h1>
      <section className="terminal-card p-6" aria-label="Account">
        <AccountBasicsForm name={account.name ?? ""} email={account.email} memberSince={format(account.createdAt, "MMM yyyy")} />
      </section>
    </div>
  );
}
