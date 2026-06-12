/** Display + date helpers shared across screens. */

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyFmtCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `$1,250` (whole dollars) — or `$1,250.50` with `cents: true`. */
export function formatMoney(value: number, opts?: { cents?: boolean }): string {
  return (opts?.cents ? moneyFmtCents : moneyFmt).format(value);
}

/** Fraction (0.42) → `42%`. */
export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** A `@db.Date` column comes back as a UTC-midnight Date → `YYYY-MM-DD`. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
