/**
 * Exact money for the trading core. Every amount is a whole number of paise (₹1 = 100 paise) and
 * every rate is a whole number of hundred-millionths (0.05% = 50_000), so fills, charges, P&L,
 * limits and payouts never touch floating-point rupees. Postgres keeps Decimal(18,2) rupees.
 */
export type Paise = number;

/** Rates are integers over this scale: 1% = 1_000_000, 0.0001% = 100. */
export const RATE_SCALE = 100_000_000;

export function assertPaise(value: number, label = "Amount"): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a whole number of paise.`);
}

export function assertRate(rate: number, label = "Rate"): void {
  if (!Number.isSafeInteger(rate) || rate < 0) throw new RangeError(`${label} must be a non-negative integer rate.`);
}

/** Rupees with at most two decimals (programme figures, feed prices) to paise. */
export function toPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) throw new RangeError("Rupee amount must be finite.");
  const paise = Math.round(rupees * 100);
  if (Math.abs(paise) > 1e12) throw new RangeError("Rupee amount is out of range.");
  // Float noise in `rupees * 100` stays far below a thousandth of a paisa in this range.
  if (Math.abs(paise - rupees * 100) > 1e-3) {
    throw new RangeError(`₹${rupees} has more precision than one paisa.`);
  }
  return paise;
}

/**
 * A typed rupee amount to paise, or null: commas allowed, at most two decimals, a leading minus
 * for a loss, and at most `maxDigits` whole-rupee digits. Never rounds a typed value.
 */
export function parseRupees(value: string, maxDigits = 8): Paise | null {
  const trimmed = value.trim().replace(/,/g, "");
  const pattern = new RegExp(`^-?(?:\\d{1,${maxDigits}}(?:\\.\\d{0,2})?|\\.\\d{1,2})$`);
  if (!pattern.test(trimmed)) return null;
  const paise = toPaise(Number(trimmed));
  return Object.is(paise, -0) ? 0 : paise;
}

export function toRupees(paise: Paise): number {
  assertPaise(paise);
  return paise / 100;
}

/** Floor division for safe integers, corrected for floating-point quotient error. */
function floorDiv(numerator: number, denominator: number): number {
  let quotient = Math.floor(numerator / denominator);
  while (quotient * denominator > numerator) quotient -= 1;
  while ((quotient + 1) * denominator <= numerator) quotient += 1;
  return quotient;
}

/** `numerator / denominator` rounded half away from zero, exactly. Denominator must be positive. */
export function divRound(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError("divRound needs safe integers and a positive denominator.");
  }
  const magnitude = Math.abs(numerator);
  let quotient = floorDiv(magnitude, denominator);
  if ((magnitude - quotient * denominator) * 2 >= denominator) quotient += 1;
  return numerator < 0 ? -quotient : quotient;
}

/** Exact floor of `numerator / denominator` for a non-negative numerator. */
export function divFloor(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError("divFloor needs a non-negative numerator and a positive denominator.");
  }
  return floorDiv(numerator, denominator);
}

/** Exact ceiling of `numerator / denominator` for a non-negative numerator. */
export function divCeil(numerator: number, denominator: number): number {
  const quotient = divFloor(numerator, denominator);
  return quotient * denominator === numerator ? quotient : quotient + 1;
}

/** `amount × rate`, rounded to the nearest paisa (half away from zero). */
export function applyRate(amount: Paise, rate: number): Paise {
  assertPaise(amount);
  assertRate(rate);
  const product = amount * rate;
  if (!Number.isSafeInteger(product)) throw new RangeError("Amount is too large for exact rate maths.");
  return divRound(product, RATE_SCALE);
}

/** `amount × percent / 100`, rounded down to the paisa, for whole-number percentages. */
export function percentOfFloor(amount: Paise, percent: number): Paise {
  assertPaise(amount);
  if (!Number.isSafeInteger(percent) || percent < 0) throw new RangeError("Percent must be a whole number.");
  if (amount <= 0) return 0;
  return divFloor(amount * percent, 100);
}

export function formatPaise(paise: Paise, fractionDigits: 0 | 2 = 2): string {
  assertPaise(paise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(paise / 100);
}
