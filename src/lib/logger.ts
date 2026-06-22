/**
 * Minimal structured logger for server code.
 *
 * Emits one JSON line per event to stdout/stderr — the format hosts like Vercel,
 * Logtail, and Datadog ingest and let you query. No dependency; to ship logs to
 * an external service later, fan out from `emit()` (e.g. also POST to Logtail).
 *
 * Server-only: import from Server Components, Server Actions, route handlers, and
 * `proxy.ts` — not from client components (never log secrets or full PII).
 */
type Level = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

function emit(level: Level, message: string, fields?: LogFields): void {
  const entry = { level, msg: message, time: new Date().toISOString(), ...fields };
  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    // Circular/unserializable fields — fall back to the message alone.
    line = JSON.stringify({ level, msg: message, time: entry.time });
  }
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => {
    if (process.env.NODE_ENV !== "production") emit("debug", message, fields);
  },
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};

/** Normalize an unknown thrown value into safe, loggable fields. */
export function errorFields(err: unknown): LogFields {
  if (err instanceof Error) {
    return { error: err.message, errorName: err.name, stack: err.stack };
  }
  return { error: String(err) };
}
