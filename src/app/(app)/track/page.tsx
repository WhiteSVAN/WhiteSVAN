import type { Metadata } from "next";
import { Meter } from "@/components/markets/account-panel";
import { STATUS_BADGE } from "@/components/markets/account-status";
import { tradingNow } from "@/lib/accounts/clock";
import { requireMember } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { loadTrackSummary, type TrackSummary } from "@/lib/track-record-store";
import { formatPaise } from "@/lib/trading/money";
import type { BreachRule } from "@/lib/trading/rules";
import { toIst } from "@/lib/trading/time";
import { StartTrackingForm, SyncTradebookForm } from "./track-forms";

export const metadata: Metadata = { title: "Track record · WhiteSVAN" };

const dateText = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const showDate = (iso: string) => dateText.format(new Date(`${iso}T00:00:00Z`));
const money = (paise: number) => formatPaise(paise, 0);
const signed = (paise: number) => `${paise > 0 ? "+" : paise < 0 ? "−" : ""}${money(Math.abs(paise))}`;
const tone = (paise: number) => (paise > 0 ? "text-[var(--primary)]" : paise < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]");
const days = (count: number) => `${count} trading day${count === 1 ? "" : "s"}`;
const RULE_NAMES: Record<BreachRule, string> = { DAILY_LOSS: "The daily loss limit", MAX_LOSS: "The max loss limit" };
const card = "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ synced?: string }> }) {
  const user = await requireMember();
  const { synced } = await searchParams;
  const account = await prisma.tradingAccount.findFirst({
    where: { userId: user.id, trackPlanId: { not: null } },
    select: { id: true, trackPlanId: true, trackStart: true },
  });
  const summary = account ? await loadTrackSummary(account) : null;
  const today = toIst(tradingNow()).date;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="terminal-label">Track record</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Trade your Zerodha account. Pass our rules.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Trade NIFTY, BANK NIFTY and SENSEX futures and options in your own Zerodha account. Upload your tradebook and we check every day against the rules.
        </p>
      </div>

      {summary ? (
        <Tracker summary={summary} synced={synced} today={today} />
      ) : (
        <section aria-labelledby="start-title" className={card}>
          <h2 id="start-title" className="text-base font-medium">Start your track record</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Pick the account size closest to the capital you trade. The profit target and loss limits come from it, and only trades from your first day count.</p>
          <div className="mt-5"><StartTrackingForm today={today} submitLabel="Start tracking" /></div>
        </section>
      )}

      <p className="text-xs leading-5 text-[var(--faint)]">
        WhiteSVAN only reads the tradebook you upload: it never places orders in your account or holds your money. Futures and options carry a substantial risk of loss, and past performance does not guarantee future results. Nothing here is investment advice.
      </p>
    </div>
  );
}

/** One sentence on where the trader stands and what's next. */
function nextStep({ review }: TrackSummary): string {
  if (review.status === "PASSED" && review.decidedOn) return `You passed on ${showDate(review.decidedOn)}. Your record goes to the WhiteSVAN desk for review.`;
  if (review.status === "FAILED" && review.decidedOn) {
    const rules = review.rows.at(-1)?.breaches.map((rule) => RULE_NAMES[rule]).join(" and ") ?? "A loss limit";
    return `${rules} was hit on ${showDate(review.decidedOn)}. Start over to try again.`;
  }
  if (review.rows.length === 0) return "Upload your tradebook to see where you stand.";
  if (review.openPositions > 0) return `${review.openPositions} position${review.openPositions === 1 ? " has" : "s have"} no closing trade, so a pass can't be confirmed. Close every position the same day.`;
  if (review.targetLeft === 0 && review.daysLeft === 0) {
    return `Your best day is more than half of your profit. Keep trading: you pass once your total profit reaches ${money(review.profitForConsistency)}.`;
  }
  if (review.targetLeft === 0) return `Target reached. Trade ${days(review.daysLeft)} more to pass.`;
  return `Make ${money(review.targetLeft)} more profit${review.daysLeft > 0 ? ` over at least ${days(review.daysLeft)}` : ""} to pass.`;
}

function Tracker({ summary, synced, today }: { summary: TrackSummary; synced?: string; today: string }) {
  const { plan, review, start, syncedThrough } = summary;
  const { rules } = review;
  const status = STATUS_BADGE[review.status];
  const room = Math.max(0, review.balance - review.floor);

  return (
    <>
      {synced && <p role="status" className="text-sm text-[var(--primary)]">Synced {synced} closed trade{synced === "1" ? "" : "s"}.</p>}

      <section aria-labelledby="track-title" className={`${card} space-y-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="track-title" className="text-base font-medium">{plan.label} track record</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Counting from {start ? showDate(start) : "your first synced day"}{syncedThrough ? ` · trades synced to ${showDate(syncedThrough)}` : ""}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${status.className}`}>{status.text}</span>
        </div>
        <p className="text-sm leading-6">{nextStep(summary)}</p>
        <p className="text-xs leading-5 text-[var(--muted)]">
          The rules: make {money(rules.profitTarget)} profit over at least {days(rules.minTradingDays)}. Don&apos;t lose {money(rules.dailyLoss)} in a day, or let your balance fall {money(rules.maxLoss)} below its highest day-end level (that limit never rises above your starting {money(rules.startingBalance)}).
        </p>
        <div className="space-y-3">
          <Meter label="Profit" value={`${signed(review.profit)} of ${money(rules.profitTarget)}`} detail={`${review.tradingDays} of ${rules.minTradingDays} trading days`} used={review.profit / rules.profitTarget} />
          <Meter label="Worst day" value={`${money(review.worstDayLoss)} of ${money(rules.dailyLoss)}`} detail="Your biggest one-day loss" used={review.worstDayLoss / rules.dailyLoss} danger />
          <Meter label="Max loss" value={`${money(room)} left`} detail={`The limit is a balance of ${money(review.floor)}`} used={1 - room / rules.maxLoss} danger />
        </div>
      </section>

      <section aria-labelledby="sync-title" className={`${card} space-y-4`}>
        <h2 id="sync-title" className="text-base font-medium">Upload your trades</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          In Zerodha Console, open Reports → Tradebook, choose F&amp;O, pick the dates and download the CSV. Upload each new export here{syncedThrough ? `, starting the day after ${showDate(syncedThrough)}` : ""}.
        </p>
        <SyncTradebookForm />
        <p className="text-xs leading-5 text-[var(--faint)]">Charges are estimated from Zerodha&apos;s published rates. Loss limits are checked on each day&apos;s closed trades.</p>
      </section>

      {review.rows.length > 0 && (
        <section aria-labelledby="days-title" className={card}>
          <h2 id="days-title" className="text-base font-medium">Daily results</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs text-[var(--muted)]">
              <tr><th scope="col" className="py-2 font-normal">Date</th><th scope="col" className="py-2 text-right font-normal">Profit / loss</th><th scope="col" className="py-2 text-right font-normal">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono text-xs">
              {[...review.rows].reverse().map((row) => (
                <tr key={row.date}>
                  <td className="py-2.5">{showDate(row.date)}</td>
                  <td className={`py-2.5 text-right ${tone(row.net)}`}>{signed(row.net)}</td>
                  <td className="py-2.5 text-right">{money(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <details open={review.status === "FAILED"} className={card}>
        <summary className="cursor-pointer text-sm font-medium">Start over</summary>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Choose a size and a new first day. Trades before that day stop counting.</p>
        <div className="mt-4"><StartTrackingForm today={today} submitLabel="Start over" /></div>
      </details>
    </>
  );
}
