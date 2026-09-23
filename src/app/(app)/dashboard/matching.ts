/**
 * "Matching your preferences" for the client home. Same semantics as the
 * /explore preference prefill: any-of within a dimension (markets, regions,
 * strategy styles), all-of across the dimensions the client actually set.
 * Order is preserved (the directory arrives most-recently-updated first) —
 * never re-ranked by return or score.
 */

export interface MatchPreferences {
  markets: readonly string[];
  regions: readonly string[];
  strategyTags: readonly string[];
}

export interface MatchableTrader {
  markets: readonly string[];
  strategyTags: readonly string[];
  region: string | null;
}

export function hasPreferences(prefs: MatchPreferences | null | undefined): prefs is MatchPreferences {
  return !!prefs && (prefs.markets.length > 0 || prefs.regions.length > 0 || prefs.strategyTags.length > 0);
}

export function matchesPreferences(trader: MatchableTrader, prefs: MatchPreferences): boolean {
  if (prefs.markets.length && !prefs.markets.some((m) => trader.markets.includes(m))) return false;
  if (prefs.strategyTags.length && !prefs.strategyTags.some((s) => trader.strategyTags.includes(s))) {
    return false;
  }
  if (prefs.regions.length && !(trader.region && prefs.regions.includes(trader.region))) return false;
  return true;
}

/**
 * The first `limit` traders matching the client's preferences. Without any
 * stated preference, the most recently updated traders are returned as-is.
 */
export function pickMatches<T extends MatchableTrader>(
  traders: readonly T[],
  prefs: MatchPreferences | null | undefined,
  limit = 6,
): T[] {
  const pool = hasPreferences(prefs) ? traders.filter((t) => matchesPreferences(t, prefs)) : traders;
  return pool.slice(0, Math.max(0, limit));
}
