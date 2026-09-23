/**
 * Controlled vocabularies for structured profile fields. The DB stores the keys;
 * the UI shows the labels. Keeping these in one place is what lets discovery
 * filter on real structured data instead of free-text strategy blurbs.
 */

export type Option = { key: string; label: string };

export const MARKETS: Option[] = [
  { key: "us_equities", label: "US equities" },
  { key: "us_options", label: "US options" },
  { key: "us_futures", label: "US futures" },
  { key: "in_equities", label: "NSE / BSE equities" },
  { key: "in_fno", label: "NSE F&O" },
  { key: "in_commodities", label: "MCX commodities" },
  { key: "forex", label: "Forex" },
  { key: "crypto", label: "Crypto" },
  { key: "global_equities", label: "Global equities" },
];

export const STRATEGY_TAGS: Option[] = [
  { key: "intraday", label: "Intraday" },
  { key: "swing", label: "Swing" },
  { key: "positional", label: "Positional" },
  { key: "options_selling", label: "Options selling" },
  { key: "options_buying", label: "Options buying" },
  { key: "systematic", label: "Systematic / algo" },
  { key: "discretionary", label: "Discretionary" },
  { key: "momentum", label: "Momentum" },
  { key: "mean_reversion", label: "Mean reversion" },
  { key: "arbitrage", label: "Arbitrage" },
  { key: "long_term", label: "Long-term investing" },
];

export const REGIONS: Option[] = [
  { key: "IN", label: "India" },
  { key: "US", label: "United States" },
  { key: "UK", label: "United Kingdom" },
  { key: "EU", label: "Europe" },
  { key: "SG", label: "Singapore" },
  { key: "AE", label: "UAE" },
  { key: "OTHER", label: "Other" },
];

/** Bands, never exact figures — capital scale is context, not a leaderboard. */
export const CAPITAL_BANDS: Option[] = [
  { key: "lt_10k", label: "Under $10k / ₹10L" },
  { key: "10k_100k", label: "$10k–$100k / ₹10L–₹1Cr" },
  { key: "100k_1m", label: "$100k–$1M / ₹1Cr–₹10Cr" },
  { key: "gt_1m", label: "Over $1M / ₹10Cr" },
];

export const REGISTRATION_TYPES: Option[] = [
  { key: "none", label: "Not registered" },
  { key: "sebi_ra", label: "SEBI Research Analyst" },
  { key: "sebi_ia", label: "SEBI Investment Adviser" },
  { key: "sebi_pms", label: "SEBI PMS" },
  { key: "us_ria", label: "US RIA / IAR" },
  { key: "us_cta", label: "NFA CTA" },
  { key: "other", label: "Other regulator" },
];

export const CLIENT_TYPES: Option[] = [
  { key: "individual", label: "Individual investor" },
  { key: "family_office", label: "Family office" },
  { key: "prop_firm", label: "Prop firm" },
  { key: "fund", label: "Fund / allocator" },
  { key: "broker", label: "Broker" },
  { key: "research_team", label: "Research team" },
  { key: "recruiter", label: "Recruiter" },
  { key: "other", label: "Other" },
];

export const INQUIRY_TOPICS: Option[] = [
  { key: "hiring", label: "Hiring / role" },
  { key: "research", label: "Research collaboration" },
  { key: "diligence", label: "Record diligence questions" },
  { key: "partnership", label: "Business partnership" },
  { key: "other", label: "Other" },
];

/** Public-profile sections a trader can hide without deleting anything. */
export const PROFILE_SECTIONS: Option[] = [
  { key: "performance", label: "Performance charts & metrics" },
  { key: "calendar", label: "Daily calendar" },
  { key: "history", label: "Published version history" },
  { key: "evidence", label: "Attached evidence list" },
  { key: "posts", label: "Posts" },
  { key: "briefs", label: "Written briefs" },
  { key: "credentials", label: "Credentials & registration" },
];

const index = (options: Option[]) => new Map(options.map((o) => [o.key, o.label]));
const MAPS = {
  markets: index(MARKETS),
  strategyTags: index(STRATEGY_TAGS),
  regions: index(REGIONS),
  capitalBands: index(CAPITAL_BANDS),
  registrationTypes: index(REGISTRATION_TYPES),
  clientTypes: index(CLIENT_TYPES),
  inquiryTopics: index(INQUIRY_TOPICS),
  sections: index(PROFILE_SECTIONS),
};
export type OptionSet = keyof typeof MAPS;

/** Label for a stored key; unknown keys fall back to the key itself. */
export function optionLabel(set: OptionSet, key: string | null | undefined): string | null {
  if (!key) return null;
  return MAPS[set].get(key) ?? key;
}

export function optionLabels(set: OptionSet, keys: readonly string[] | null | undefined): string[] {
  return (keys ?? []).map((k) => optionLabel(set, k)!).filter(Boolean);
}

/** Keep only keys that belong to the set (form input is untrusted). */
export function pickKeys(set: OptionSet, values: readonly unknown[]): string[] {
  const allowed = MAPS[set];
  return [...new Set(values.filter((v): v is string => typeof v === "string" && allowed.has(v)))];
}

export function pickKey(set: OptionSet, value: unknown): string | null {
  return typeof value === "string" && MAPS[set].has(value) ? value : null;
}
