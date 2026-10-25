/**
 * The trader's journal (pure): each evaluation account's daily P&L and trade count from its engine
 * record, merged across accounts, the headline totals and the month grid for the P&L calendar.
 * Day notes live in the database (JournalNote).
 */
import { deskStep, type Desk } from "@/lib/trading/desk";
import { riskMeters } from "@/lib/trading/engine";
import type { Paise } from "@/lib/trading/money";

/** Longest note a trader can keep on a day. */
export const NOTE_MAX_LENGTH = 2_000;

export interface JournalDay {
  /** IST trading date, `YYYY-MM-DD`. */
  date: string;
  /** Net P&L after charges; a day still trading includes its open P&L. */
  net: Paise;
  /** Fills that day; null where the desk didn't count them yet. */
  trades: number | null;
  /** Still trading, so the figures move with the market. */
  open: boolean;
}

/**
 * The desk as the next poll would leave it: a trading day nobody closed (the page was shut before
 * 15:30) is squared off at its last prices and closed, exactly as the engine does on its next event.
 * For display only; nothing is saved.
 */
export function settledDesk(desk: Desk, now: number): Desk {
  return deskStep(desk, { kind: "clock", at: now }, new Map()).desk;
}

/** One account's trading days, oldest first: closed days from the engine, then today while it trades. */
export function accountDays(desk: Desk): JournalDay[] {
  const counts = desk.dayTrades ?? {};
  const days: JournalDay[] = desk.state.days.map((day) => ({ date: day.date, net: day.net, trades: counts[day.date] ?? null, open: false }));
  const today = desk.state.day;
  if (today && !today.closed && today.traded) {
    const meters = riskMeters(desk.state);
    days.push({ date: today.date, net: meters.todayNet + meters.unrealised, trades: counts[today.date] ?? null, open: true });
  }
  return days;
}

/** Several accounts' days summed by date, oldest first. */
export function mergeDays(lists: readonly (readonly JournalDay[])[]): JournalDay[] {
  const byDate = new Map<string, JournalDay>();
  for (const list of lists) {
    for (const day of list) {
      const seen = byDate.get(day.date);
      byDate.set(day.date, seen
        ? { date: day.date, net: seen.net + day.net, trades: seen.trades === null && day.trades === null ? null : (seen.trades ?? 0) + (day.trades ?? 0), open: seen.open || day.open }
        : { ...day });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface JournalTotals {
  net: Paise;
  /** Days with at least one fill. */
  days: number;
  winning: number;
  losing: number;
  trades: number;
}

export function journalTotals(days: readonly JournalDay[]): JournalTotals {
  return {
    net: days.reduce((sum, day) => sum + day.net, 0),
    days: days.length,
    winning: days.filter((day) => day.net > 0).length,
    losing: days.filter((day) => day.net < 0).length,
    trades: days.reduce((sum, day) => sum + (day.trades ?? 0), 0),
  };
}

const DAY_MS = 86_400_000;
const isoDate = (at: number) => new Date(at).toISOString().slice(0, 10);

/**
 * The calendar weeks of a month (`YYYY-MM`), Monday to Friday since markets are shut at weekends.
 * Days from the neighbouring months fill the first and last weeks, flagged `inMonth: false`.
 */
export function monthWeeks(month: string): { date: string; inMonth: boolean }[][] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError("Pass a month as YYYY-MM.");
  const first = Date.parse(`${month}-01T00:00:00Z`);
  const weekday = new Date(first).getUTCDay();
  // The Monday of the 1st's week, or the next Monday when the 1st falls at a weekend.
  let monday = weekday === 0 ? first + DAY_MS : weekday === 6 ? first + 2 * DAY_MS : first - (weekday - 1) * DAY_MS;
  const weeks: { date: string; inMonth: boolean }[][] = [];
  while (isoDate(monday).slice(0, 7) <= month) {
    const week = Array.from({ length: 5 }, (_, index) => {
      const date = isoDate(monday + index * DAY_MS);
      return { date, inMonth: date.startsWith(month) };
    });
    if (week.some((day) => day.inMonth)) weeks.push(week);
    monday += 7 * DAY_MS;
  }
  return weeks;
}

/** The month before or after `YYYY-MM`. */
export function shiftMonth(month: string, by: number): string {
  const [year, index] = month.split("-").map(Number);
  const at = new Date(Date.UTC(year, index - 1 + by, 1));
  return at.toISOString().slice(0, 7);
}
