/** Display + date helpers shared across screens. */

/** Account currencies a trader can pick (ISO 4217). */
export const CURRENCIES = ["USD", "INR", "EUR", "GBP", "SGD", "AED"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: "USD — US dollar",
  INR: "INR — Indian rupee",
  EUR: "EUR — Euro",
  GBP: "GBP — British pound",
  SGD: "SGD — Singapore dollar",
  AED: "AED — UAE dirham",
};

export function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/** Untrusted input → a supported currency code (falls back to `fallback`). */
export function toCurrency(value: unknown, fallback: CurrencyCode = "USD"): CurrencyCode {
  const v = typeof value === "string" ? value.trim().toUpperCase() : value;
  return isCurrency(v) ? v : fallback;
}

/** Default account currency for a trader's region: INR for India, USD otherwise. */
export function defaultCurrencyForRegion(region: string | null | undefined): CurrencyCode {
  return region === "IN" ? "INR" : "USD";
}

/** INR uses Indian digit grouping (₹12,34,567); everything else uses en-US grouping. */
function localeFor(currency: CurrencyCode): string {
  return currency === "INR" ? "en-IN" : "en-US";
}

const formatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: CurrencyCode, cents: boolean): Intl.NumberFormat {
  const key = `${currency}:${cents ? 2 : 0}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(localeFor(currency), {
      style: "currency",
      currency,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    });
    formatters.set(key, fmt);
  }
  return fmt;
}

/**
 * `$1,250` (whole units) — or `$1,250.50` with `cents: true`. `currency`
 * defaults to USD; unknown codes fall back to USD. INR renders `₹12,34,567`.
 */
export function formatMoney(
  value: number,
  opts?: { cents?: boolean; currency?: string | null },
): string {
  return moneyFormatter(toCurrency(opts?.currency), !!opts?.cents).format(value);
}

/** Just the currency sign, e.g. `$`, `₹`, `€`, `AED`. */
export function currencySymbol(currency?: string | null): string {
  const code = toCurrency(currency);
  const part = moneyFormatter(code, false)
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? code;
}

/**
 * Short signed amount for dense cells (calendar): `+1.2k` / `-850`, or
 * `+1.2L` / `+3.4Cr` for INR (lakh / crore). No currency sign.
 */
export function formatCompactSigned(value: number, currency?: string | null): string {
  const a = Math.abs(value);
  const sign = value < 0 ? "-" : "+";
  if (toCurrency(currency) === "INR") {
    if (a >= 1e7) return `${sign}${(a / 1e7).toFixed(1)}Cr`;
    if (a >= 1e5) return `${sign}${(a / 1e5).toFixed(1)}L`;
  }
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1)}M`;
  return a >= 1000 ? `${sign}${(a / 1000).toFixed(1)}k` : `${sign}${Math.round(a)}`;
}

/** Fraction (0.42) → `42%`. */
export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** A `@db.Date` column comes back as a UTC-midnight Date → `YYYY-MM-DD`. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
