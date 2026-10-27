/** How the admin portal writes its figures (pure). Missing figures show as a dash, never as 0. */
import { formatPaise, type Paise } from "@/lib/trading/money";

export const DASH = "—";

/** A ratio such as Sharpe, to two places. */
export const ratio = (value: number | null | undefined, digits = 2) => (value === null || value === undefined || !Number.isFinite(value) ? DASH : value.toFixed(digits));

/** A share (0.123) as a percentage (12.3%). */
export const percent = (share: number | null | undefined, digits = 1) => (share === null || share === undefined || !Number.isFinite(share) ? DASH : `${(share * 100).toFixed(digits)}%`);

/** Rupees from paise; whole rupees unless asked. */
export const rupees = (paise: Paise | null | undefined, digits: 0 | 2 = 0) => (paise === null || paise === undefined ? DASH : formatPaise(paise, digits));

/** Rupees with a sign: +₹1,200 or −₹300. */
export const signedRupees = (paise: Paise | null | undefined, digits: 0 | 2 = 0) => {
  if (paise === null || paise === undefined) return DASH;
  const text = formatPaise(Math.abs(paise), digits);
  return paise > 0 ? `+${text}` : paise < 0 ? `−${text}` : text;
};

/** A holding time: 45s, 12m, 2h 05m, 3d 4h. */
export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return DASH;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

const dateTimeText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const dateText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

/** IST date and time: 26 Oct, 14:05:09. */
export const istDateTime = (at: number | Date | null | undefined) => (at === null || at === undefined ? DASH : dateTimeText.format(at));

/** IST date: 26 Oct 2026. */
export const istDate = (at: number | Date | null | undefined) => (at === null || at === undefined ? DASH : dateText.format(at));

/** Tone for a signed amount, as a token class. */
export const tone = (value: number | null | undefined) => (value === null || value === undefined || value === 0 ? "" : value > 0 ? "text-[var(--primary)]" : "text-[var(--danger)]");
