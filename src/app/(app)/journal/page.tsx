import type { Metadata } from "next";
import { tradingNow } from "@/lib/accounts/clock";
import { listAccounts } from "@/lib/accounts/store";
import { requireMember } from "@/lib/auth/dal";
import { accountNumber } from "@/lib/checkout/billing";
import { prisma } from "@/lib/db";
import { accountDays, settledDesk } from "@/lib/journal";
import { findAccountPlan } from "@/lib/prop-firm";
import { toIst } from "@/lib/trading/time";
import { JournalView, type JournalAccount } from "./journal-view";

export const metadata: Metadata = { title: "Journal · WhiteSVAN" };

/** The trader's journal: P&L by day across their evaluation accounts, with a note for any day. */
export default async function JournalPage() {
  const user = await requireMember();
  const now = tradingNow();
  const [accounts, notes] = await Promise.all([
    listAccounts(user.id),
    prisma.journalNote.findMany({ where: { userId: user.id }, select: { date: true, text: true } }),
  ]);
  const journal: JournalAccount[] = accounts.map((account) => {
    const desk = settledDesk(account.desk, now);
    return {
      id: account.id,
      label: `${findAccountPlan(account.planId)?.label ?? account.planId}${account.demo ? " demo" : ""} · ${accountNumber(account.id, account.planId)}`,
      days: accountDays(desk),
      trades: desk.fills.map((fill) => ({ id: fill.id, at: fill.at, tradingSymbol: fill.tradingSymbol, side: fill.side, quantity: fill.quantity, price: fill.price, realised: fill.realised, charges: fill.charges.total })),
    };
  });

  return (
    <JournalView
      accounts={journal}
      notes={Object.fromEntries(notes.map((note) => [note.date.toISOString().slice(0, 10), note.text]))}
      today={toIst(now).date}
    />
  );
}
