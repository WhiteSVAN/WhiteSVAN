"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { journalTotals, mergeDays, monthWeeks, NOTE_MAX_LENGTH, shiftMonth, type JournalDay } from "@/lib/journal";
import type { Side } from "@/lib/trading/instruments";
import { toIst } from "@/lib/trading/time";
import { saveDayNote } from "./actions";

export interface JournalTrade {
  id: string;
  at: number;
  tradingSymbol: string;
  side: Side;
  quantity: number;
  price: number;
  realised: number;
  charges: number;
}

export interface JournalAccount {
  id: string;
  label: string;
  days: JournalDay[];
  /** The account's most recent fills. */
  trades: JournalTrade[];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const rupeeText = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const priceText = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthText = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });
const dayText = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const clockText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Whole rupees with a sign: +₹1,234. */
const signed = (paise: number) => `${paise > 0 ? "+" : paise < 0 ? "−" : ""}₹${rupeeText.format(Math.abs(paise) / 100)}`;
/** Short form for small calendar cells: +₹1.2k, −₹2.5L. */
function compact(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const sign = paise > 0 ? "+" : paise < 0 ? "−" : "";
  const body = rupees >= 1e5 ? `${(rupees / 1e5).toFixed(1)}L` : rupees >= 1e3 ? `${(rupees / 1e3).toFixed(1)}k` : rupeeText.format(rupees);
  return `${sign}₹${body}`;
}
const tone = (paise: number) => (paise > 0 ? "text-[var(--primary)]" : paise < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]");
const cellTone = (paise: number) => (paise > 0 ? "border-[var(--primary)]/40 bg-[var(--primary)]/10" : paise < 0 ? "border-[var(--danger)]/40 bg-[var(--danger)]/10" : "border-[var(--border)] bg-[var(--card-deep)]");
const at = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * The journal: the headline numbers, a month of daily P&L Monday to Friday with weekly totals, and
 * the selected day's trades and note. `today` is the IST trading date.
 */
export function JournalView({ accounts, notes: savedNotes, today }: { accounts: JournalAccount[]; notes: Record<string, string>; today: string }) {
  const [accountId, setAccountId] = useState("all");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [notes, setNotes] = useState(savedNotes);
  const [draft, setDraft] = useState(savedNotes[today] ?? "");
  const [status, setStatus] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const chosen = accountId === "all" ? accounts : accounts.filter((account) => account.id === accountId);
  const days = mergeDays(chosen.map((account) => account.days));
  const byDate = new Map(days.map((day) => [day.date, day]));
  const totals = journalTotals(days);
  const weeks = monthWeeks(month);
  const selectedDay = byDate.get(selected);
  const trades = chosen.flatMap((account) => account.trades).filter((trade) => toIst(trade.at).date === selected).sort((a, b) => a.at - b.at);
  const dirty = draft.trim() !== (notes[selected] ?? "");

  const pick = (date: string) => {
    setSelected(date);
    setDraft(notes[date] ?? "");
    setStatus(null);
  };
  const save = () => {
    const text = draft;
    const date = selected;
    startSaving(async () => {
      const result = await saveDayNote(date, text);
      if ("error" in result) return setStatus({ tone: "bad", text: result.error });
      setNotes((current) => {
        const next = { ...current };
        if (text.trim()) next[date] = text.trim();
        else delete next[date];
        return next;
      });
      setStatus({ tone: "good", text: text.trim() ? "Note saved." : "Note removed." });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Journal</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Your P&amp;L by day, with a note for any day you want to remember.</p>
        </div>
        {accounts.length > 1 && (
          <label className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Account
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 block min-h-10 rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-3 font-mono text-xs normal-case tracking-normal text-[var(--foreground)]">
              <option value="all">All accounts</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
            </select>
          </label>
        )}
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ["Net P&L", signed(totals.net), tone(totals.net), totals.days > 0 ? `After charges, over ${totals.days} trading day${totals.days === 1 ? "" : "s"}` : "No trading days yet"],
          ["Win rate", totals.days > 0 ? `${Math.round((totals.winning / totals.days) * 100)}%` : "—", "", `${totals.winning} of ${totals.days} day${totals.days === 1 ? "" : "s"} in profit`],
          ["Trades", rupeeText.format(totals.trades), "", "Fills, buys and sells"],
        ].map(([term, value, className, detail]) => (
          <div key={term} className="terminal-card p-5">
            <dt className="text-xs text-[var(--muted)]">{term}</dt>
            <dd className={`mt-2 font-mono text-2xl tracking-tight ${className}`}>{value}</dd>
            <dd className="mt-1 text-xs text-[var(--faint)]">{detail}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="terminal-card p-4 sm:p-6" aria-labelledby="calendar-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="calendar-title" className="text-base font-medium">P&amp;L calendar</h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--card-raised)]"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
              <p className="min-w-36 text-center text-sm" aria-live="polite">{monthText.format(at(`${month}-01`))}</p>
              <button type="button" onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--card-raised)]"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.1fr)] gap-1.5 sm:gap-2" role="grid" aria-label={`P&L for ${monthText.format(at(`${month}-01`))}`}>
            {[...WEEKDAYS, "Week"].map((name) => <p key={name} role="columnheader" className="pb-1 text-center text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{name}</p>)}
            {weeks.map((week) => {
              const weekDays = week.map(({ date }) => byDate.get(date)).filter((day): day is JournalDay => Boolean(day));
              const weekNet = weekDays.reduce((sum, day) => sum + day.net, 0);
              const weekTrades = weekDays.reduce((sum, day) => sum + (day.trades ?? 0), 0);
              return (
                <div key={week[0].date} role="row" className="contents">
                  {week.map(({ date, inMonth }) => {
                    const day = byDate.get(date);
                    const note = Boolean(notes[date]);
                    return (
                      <button
                        key={date}
                        type="button"
                        role="gridcell"
                        aria-selected={date === selected}
                        aria-label={`${dayText.format(at(date))}${day ? `, ${signed(day.net)}${day.trades !== null ? `, ${day.trades} trades` : ""}` : ", no trades"}${note ? ", has a note" : ""}`}
                        onClick={() => pick(date)}
                        className={`relative flex min-h-16 flex-col items-start rounded-lg border p-1.5 text-left sm:min-h-20 sm:p-2 ${day ? cellTone(day.net) : "border-[var(--border)]"} ${inMonth ? "" : "opacity-40"} ${date === selected ? "ring-2 ring-[var(--primary)]" : ""} ${date === today ? "outline outline-1 outline-offset-2 outline-[var(--border-strong)]" : ""}`}
                      >
                        <span className="font-mono text-[10px] text-[var(--muted)]">{date.slice(8)}</span>
                        {note && <NotebookPen className="absolute right-1.5 top-1.5 h-3 w-3 text-[var(--muted)]" aria-hidden="true" />}
                        {day && (
                          <>
                            <span className={`mt-auto font-mono text-[11px] sm:text-sm ${tone(day.net)}`}><span className="sm:hidden">{compact(day.net)}</span><span className="hidden sm:inline">{signed(day.net)}</span></span>
                            {day.trades !== null && <span className="hidden text-[10px] text-[var(--muted)] sm:block">{day.trades} trade{day.trades === 1 ? "" : "s"}</span>}
                          </>
                        )}
                      </button>
                    );
                  })}
                  <div role="gridcell" className={`flex min-h-16 flex-col justify-end rounded-lg border p-1.5 sm:min-h-20 sm:p-2 ${weekDays.length ? cellTone(weekNet) : "border-dashed border-[var(--border)]"}`}>
                    {weekDays.length > 0 && (
                      <>
                        <span className={`font-mono text-[11px] sm:text-sm ${tone(weekNet)}`}><span className="sm:hidden">{compact(weekNet)}</span><span className="hidden sm:inline">{signed(weekNet)}</span></span>
                        <span className="hidden text-[10px] text-[var(--muted)] sm:block">{weekTrades} trade{weekTrades === 1 ? "" : "s"}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-[var(--faint)]">Days are net of charges. Today includes open positions at their last price until the 15:20 square-off.</p>
        </section>

        <aside className="terminal-card space-y-5 p-5 lg:sticky lg:top-24" aria-labelledby="day-title">
          <div>
            <h2 id="day-title" className="text-base font-medium">{dayText.format(at(selected))}</h2>
            {selectedDay ? (
              <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className={`font-mono text-xl ${tone(selectedDay.net)}`}>{signed(selectedDay.net)}</span>
                {selectedDay.trades !== null && <span className="text-[var(--muted)]">{selectedDay.trades} trade{selectedDay.trades === 1 ? "" : "s"}</span>}
                {selectedDay.open && <span className="text-xs text-[var(--muted)]">So far today</span>}
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">No trades this day.</p>
            )}
          </div>

          <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-2">
            <label htmlFor="day-note" className="block text-xs text-[var(--muted)]">Note</label>
            <textarea id="day-note" value={draft} onChange={(event) => { setDraft(event.target.value); setStatus(null); }} maxLength={NOTE_MAX_LENGTH} rows={6} placeholder="What did you trade, why, and what would you do differently?" className="block w-full rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-3 py-2 text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--faint)] focus:border-[var(--primary)] focus:outline-none" />
            <div className="flex items-center justify-between gap-3">
              <p aria-live="polite" className={`text-xs ${status?.tone === "bad" ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}>{status?.text}</p>
              <button type="submit" disabled={saving || !dirty} className="min-h-9 rounded-md bg-[var(--primary)] px-4 text-xs font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Save note"}</button>
            </div>
          </form>

          <div>
            <h3 className="text-xs text-[var(--muted)]">Trades</h3>
            {trades.length > 0 ? (
              <ul className="mt-2 divide-y divide-[var(--border)] font-mono text-xs">
                {trades.map((trade) => (
                  <li key={trade.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="text-[var(--faint)]">{clockText.format(trade.at)}</span>{" "}
                      <span className={trade.side === "BUY" ? "text-[var(--primary)]" : "text-[var(--danger)]"}>{trade.side === "BUY" ? "Buy" : "Sell"}</span>{" "}
                      {trade.quantity} <span className="break-all">{trade.tradingSymbol}</span> @ {priceText.format(trade.price / 100)}
                    </span>
                    {trade.realised !== 0 && <span className={`shrink-0 ${tone(trade.realised)}`}>{signed(trade.realised)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--faint)]">{selectedDay?.trades ? "This day's trades are older than the recent trades kept in detail." : "None."}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
