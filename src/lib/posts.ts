/**
 * Structured posts: type definitions, field validation, signal-language checks,
 * and execution matching. Pure — the server actions in src/app/(app)/feed call
 * these; nothing here touches the database.
 *
 * Posts are research and discussion. They carry no entry/target fields, and the
 * signal filter rejects "buy now"-style calls, so the feed cannot turn into a
 * signal room.
 */
import { findBannedPhrases } from "@/lib/ai/compliance";

export const POST_TYPES = [
  "MARKET_VIEW",
  "TRADE_THESIS",
  "TRADE_REVIEW",
  "RESEARCH",
  "PERFORMANCE_UPDATE",
  "EDUCATIONAL",
] as const;
export type PostTypeKey = (typeof POST_TYPES)[number];

export interface PostField {
  key: string;
  label: string;
  kind: "text" | "textarea" | "date" | "select";
  required?: boolean;
  options?: { key: string; label: string }[];
  placeholder?: string;
}

export interface PostTypeDef {
  label: string;
  blurb: string;
  /** Needs at least one symbol. */
  needsSymbol: boolean;
  fields: PostField[];
}

const HORIZON = [
  { key: "intraday", label: "Intraday" },
  { key: "days", label: "Days" },
  { key: "weeks", label: "Weeks" },
  { key: "months", label: "Months" },
];

export const POST_TYPE_DEFS: Record<PostTypeKey, PostTypeDef> = {
  MARKET_VIEW: {
    label: "Market view",
    blurb: "How you read current conditions, and what would change your mind.",
    needsSymbol: false,
    fields: [
      { key: "horizon", label: "Horizon", kind: "select", options: HORIZON, required: true },
      { key: "changeMind", label: "What would change this view", kind: "textarea", required: true },
    ],
  },
  TRADE_THESIS: {
    label: "Trade thesis",
    blurb: "The reasoning behind a position idea — with its risks and invalidation.",
    needsSymbol: true,
    fields: [
      { key: "horizon", label: "Horizon", kind: "select", options: HORIZON, required: true },
      { key: "invalidation", label: "Invalidation — what proves this wrong", kind: "textarea", required: true },
      { key: "risks", label: "Key risks", kind: "textarea", required: true },
    ],
  },
  TRADE_REVIEW: {
    label: "Trade review",
    blurb: "A post-mortem of a trade you took. Matched against your imported executions.",
    needsSymbol: true,
    fields: [
      { key: "tradeDate", label: "Trade date", kind: "date", required: true },
      { key: "outcome", label: "What happened", kind: "textarea", required: true },
      { key: "lesson", label: "What you would do differently", kind: "textarea" },
    ],
  },
  RESEARCH: {
    label: "Research",
    blurb: "Longer-form work: data, method, and sources.",
    needsSymbol: false,
    fields: [
      { key: "method", label: "Method / data used", kind: "textarea", required: true },
      { key: "sources", label: "Sources", kind: "textarea" },
    ],
  },
  PERFORMANCE_UPDATE: {
    label: "Performance update",
    blurb: "Commentary on your latest published record. The record itself is attached automatically.",
    needsSymbol: false,
    fields: [],
  },
  EDUCATIONAL: {
    label: "Educational",
    blurb: "Explain a concept, tool, or process.",
    needsSymbol: false,
    fields: [{ key: "level", label: "Level", kind: "select", options: [
      { key: "beginner", label: "Beginner" },
      { key: "intermediate", label: "Intermediate" },
      { key: "advanced", label: "Advanced" },
    ] }],
  },
};

export function isPostType(value: unknown): value is PostTypeKey {
  return typeof value === "string" && (POST_TYPES as readonly string[]).includes(value);
}

/** Calls to action that would make a post a signal rather than research. */
export const SIGNAL_PHRASES = [
  "buy now",
  "sell now",
  "enter now",
  "exit now",
  "copy this trade",
  "follow my trades",
  "join my paid",
  "paid group",
  "vip group",
  "telegram group",
  "sure shot",
  "jackpot",
] as const;

/** Banned compliance phrases + signal phrases present in the text. */
export function postLanguageIssues(text: string): string[] {
  const lower = text.toLowerCase();
  const signal = SIGNAL_PHRASES.filter((p) => lower.includes(p));
  return [...new Set([...findBannedPhrases(text), ...signal])];
}

/** Normalize a free-text symbol list: "spy, $qqq  NIFTY" → ["SPY","QQQ","NIFTY"]. */
export function parseSymbols(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.replace(/^\$/, "").trim().toUpperCase())
        .filter((s) => /^[A-Z0-9.&_-]{1,24}$/.test(s)),
    ),
  ].slice(0, 5);
}

export type FieldValues = Record<string, string>;

/** A real YYYY-MM-DD calendar date (rejects 2026-02-31). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** Validate type-specific fields. Returns the cleaned values or per-field errors. */
export function validatePostFields(
  type: PostTypeKey,
  input: Record<string, unknown>,
): { ok: true; values: FieldValues } | { ok: false; errors: Record<string, string> } {
  const values: FieldValues = {};
  const errors: Record<string, string> = {};
  for (const field of POST_TYPE_DEFS[type].fields) {
    const raw = typeof input[field.key] === "string" ? (input[field.key] as string).trim() : "";
    if (!raw) {
      if (field.required) errors[field.key] = `${field.label} is required.`;
      continue;
    }
    if (field.kind === "select" && !field.options?.some((o) => o.key === raw)) {
      errors[field.key] = `Choose a valid ${field.label.toLowerCase()}.`;
      continue;
    }
    if (field.kind === "date" && !isCalendarDate(raw)) {
      errors[field.key] = "Use a valid date.";
      continue;
    }
    values[field.key] = raw.slice(0, 2000);
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

export interface ExecutionRow {
  id: string;
  symbol: string;
  tradeDate: string; // YYYY-MM-DD
}

function normalizeSymbol(symbol: string): string {
  return symbol.replace(/^\$/, "").trim().toUpperCase();
}

/**
 * Find an imported execution that genuinely matches a trade-review post: same
 * trade date and the same instrument. An option/future row matches its
 * underlying when the imported symbol starts with the post symbol followed by a
 * space or digit (e.g. "SPY 240119C00470000", "NIFTY24JANFUT").
 */
export function matchExecution(
  rows: readonly ExecutionRow[],
  symbol: string,
  tradeDate: string,
): string | null {
  const want = normalizeSymbol(symbol);
  if (!want) return null;
  const hit = rows.find((row) => {
    if (row.tradeDate !== tradeDate) return false;
    const have = normalizeSymbol(row.symbol);
    if (have === want) return true;
    return have.startsWith(want) && /^[\s\d]/.test(have.slice(want.length));
  });
  return hit?.id ?? null;
}

// ─────────────────────────────────────────────────────────────
// Composer input, display, and moderation helpers (pure).
// ─────────────────────────────────────────────────────────────

export const POST_LIMITS = {
  title: 140,
  body: 5000,
  comment: 2000,
  flagNote: 300,
} as const;

/** Reasons a reader can flag a post. Stored as the label on PostFlag.reason. */
export const FLAG_REASONS = [
  { key: "signal", label: "Trade signal or call to action" },
  { key: "solicitation", label: "Solicitation, paid group, or copy-trading" },
  { key: "misleading", label: "Misleading performance claim" },
  { key: "spam", label: "Spam" },
  { key: "abuse", label: "Harassment or abuse" },
  { key: "other", label: "Other" },
] as const;

/** Build the stored flag reason from a reason key + optional note (null when the key is unknown). */
export function flagReason(key: unknown, note: unknown): string | null {
  const reason = FLAG_REASONS.find((r) => r.key === key);
  if (!reason) return null;
  const detail = typeof note === "string" ? note.trim().slice(0, POST_LIMITS.flagNote) : "";
  return detail ? `${reason.label}: ${detail}` : reason.label;
}

/** Form-name prefix for type-specific fields, so they never collide with title/body. */
export const FIELD_PREFIX = "field_";

export interface PostInput {
  type: unknown;
  title: unknown;
  body: unknown;
  symbols: unknown;
  /** Raw type-specific values keyed by field key (without FIELD_PREFIX). */
  fields: Record<string, unknown>;
}

export interface ValidPost {
  type: PostTypeKey;
  title: string;
  body: string;
  symbols: string[];
  fields: FieldValues;
}

export type PostInputResult =
  | { ok: true; post: ValidPost }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** "2026-09-24" in UTC for the given instant. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Validate a composer submission end to end: type, title, body, symbols, the
 * type's structured fields, and the signal/compliance language filter across
 * every piece of text. `today` bounds trade-review dates (no future trades).
 */
export function validatePostInput(input: PostInput, today: string = utcDay()): PostInputResult {
  const fieldErrors: Record<string, string> = {};
  if (!isPostType(input.type)) {
    return { ok: false, error: "Choose a post type.", fieldErrors: { type: "Choose a post type." } };
  }
  const type = input.type;
  const def = POST_TYPE_DEFS[type];

  const title = text(input.title);
  if (title.length < 3) fieldErrors.title = "Add a title (at least 3 characters).";
  else if (title.length > POST_LIMITS.title) fieldErrors.title = `Keep the title under ${POST_LIMITS.title} characters.`;

  const body = text(input.body);
  if (body.length < 1) fieldErrors.body = "Write the post body.";
  else if (body.length > POST_LIMITS.body) fieldErrors.body = `Keep the body under ${POST_LIMITS.body} characters.`;

  const symbols = parseSymbols(text(input.symbols));
  if (def.needsSymbol && symbols.length === 0) fieldErrors.symbols = "Add at least one symbol (e.g. SPY, NIFTY).";

  const checked = validatePostFields(type, input.fields);
  const fields = checked.ok ? checked.values : {};
  if (!checked.ok) {
    for (const [key, message] of Object.entries(checked.errors)) fieldErrors[`${FIELD_PREFIX}${key}`] = message;
  }
  // One day of slack: a trader east of UTC may review "today's" trade before UTC rolls over.
  const latest = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  if (type === "TRADE_REVIEW" && fields.tradeDate && fields.tradeDate > latest) {
    fieldErrors[`${FIELD_PREFIX}tradeDate`] = "A trade review covers a trade you already took — the date can't be in the future.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Fix the highlighted fields.", fieldErrors };
  }

  const issues = postLanguageIssues([title, body, ...Object.values(fields)].join("\n"));
  if (issues.length > 0) {
    return {
      ok: false,
      error: `Posts are research and discussion, not signals or solicitations. Remove: ${issues.map((i) => `"${i}"`).join(", ")}.`,
      fieldErrors: {},
    };
  }

  return { ok: true, post: { type, title, body, symbols, fields } };
}

/** Validate a comment body. Returns the cleaned text or a user-facing error. */
export function validateComment(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = text(raw);
  if (!body) return { ok: false, error: "Write a comment first." };
  if (body.length > POST_LIMITS.comment) return { ok: false, error: `Keep comments under ${POST_LIMITS.comment} characters.` };
  const issues = postLanguageIssues(body);
  if (issues.length > 0) {
    return {
      ok: false,
      error: `Comments are research discussion, not signals or solicitations. Remove: ${issues.map((i) => `"${i}"`).join(", ")}.`,
    };
  }
  return { ok: true, body };
}

/** The labelled, non-empty structured fields of a post, in definition order. */
export function postFieldEntries(type: PostTypeKey, fields: unknown): { key: string; label: string; value: string }[] {
  if (!fields || typeof fields !== "object") return [];
  const values = fields as Record<string, unknown>;
  const out: { key: string; label: string; value: string }[] = [];
  for (const field of POST_TYPE_DEFS[type].fields) {
    const raw = values[field.key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const value =
      field.kind === "select" ? (field.options?.find((o) => o.key === raw)?.label ?? raw) : raw;
    out.push({ key: field.key, label: field.label, value });
  }
  return out;
}

/**
 * Which of a post's symbols the verified trade matched (for the badge label).
 * Falls back to the imported symbol if the post symbols no longer match.
 */
export function verifiedSymbol(symbols: readonly string[], trade: { symbol: string; tradeDate: string }): string {
  for (const symbol of symbols) {
    if (matchExecution([{ id: "t", ...trade }], symbol, trade.tradeDate)) return symbol;
  }
  return normalizeSymbol(trade.symbol);
}

/**
 * First imported execution matching any of the post's symbols on `tradeDate`,
 * or null. Only a genuine match earns the verified-position badge.
 */
export function matchAnySymbol(rows: readonly ExecutionRow[], symbols: readonly string[], tradeDate: string): string | null {
  for (const symbol of symbols) {
    const hit = matchExecution(rows, symbol, tradeDate);
    if (hit) return hit;
  }
  return null;
}
