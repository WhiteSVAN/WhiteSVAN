/**
 * The trading engine's clock for stored accounts. Outside production, TRADING_CLOCK_OFFSET_MS
 * shifts it so local tests against the Kite stand-in can trade a simulated session at any hour;
 * production always runs on real time.
 */
export function tradingNow(env: Partial<Record<string, string>> = process.env): number {
  const offset = env.NODE_ENV !== "production" ? Number(env.TRADING_CLOCK_OFFSET_MS ?? 0) : 0;
  return Date.now() + (Number.isFinite(offset) ? offset : 0);
}
