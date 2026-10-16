/**
 * IST clock helpers. The engine stores UTC epoch milliseconds and reasons in IST wall-clock time
 * (UTC+05:30 all year; India has no daylight saving). Pure: callers pass every timestamp in.
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 86_400_000;

export interface IstMoment {
  /** IST calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Seconds after IST midnight. */
  second: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

export function toIst(epochMs: number): IstMoment {
  if (!Number.isFinite(epochMs)) throw new RangeError("Timestamp must be finite epoch milliseconds.");
  const shifted = epochMs + IST_OFFSET_MS;
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS;
  const midnight = new Date(dayStart);
  return {
    date: midnight.toISOString().slice(0, 10),
    second: Math.floor((shifted - dayStart) / 1000),
    weekday: midnight.getUTCDay(),
  };
}

/** `"HH:MM"` (24-hour) to seconds after midnight. */
export function clockSeconds(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new RangeError(`"${hhmm}" is not an HH:MM time.`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60;
}

/** Epoch milliseconds for an IST wall-clock second on an IST date. */
export function istInstant(date: string, second: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`"${date}" is not a YYYY-MM-DD date.`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) + second * 1000 - IST_OFFSET_MS;
}

/** `"YYYY-MM-DD HH:MM"` or `"YYYY-MM-DD HH:MM:SS"` in IST to epoch milliseconds (tests, replays). */
export function ist(dateTime: string): number {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec(dateTime);
  if (!match) throw new RangeError(`"${dateTime}" is not an IST date and time.`);
  return istInstant(match[1], clockSeconds(match[2]) + Number(match[3] ?? 0));
}

/** Weekday check only; the exchange holiday calendar decides real trading days. */
export function isWeekday(date: string): boolean {
  const weekday = toIst(istInstant(date, 12 * 3600)).weekday;
  return weekday >= 1 && weekday <= 5;
}
