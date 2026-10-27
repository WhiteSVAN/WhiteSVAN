/** Building blocks of the admin portal's pages (server-rendered). */
import Link from "next/link";
import type { AccountEventKind } from "@/generated/prisma/client";
import { EVENT_LABELS } from "@/lib/admin/filters";
import { percent, rupees } from "@/lib/admin/format";
import { formatPaise } from "@/lib/trading/money";

/** A headline figure: label, value (sans, proportional figures) and an optional note. */
export function StatTile({ label, value, note, valueClass = "" }: { label: string; value: string; note?: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</p>
      {note && <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">{note}</p>}
    </div>
  );
}

export function Panel({ title, note, action, children, id }: { title: string; note?: string; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} aria-label={title} className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-[var(--muted)]">{note}</p>}
        </div>
        {action}
      </div>
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}

/** A table that scrolls sideways inside its panel on narrow screens, never the page. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="-mx-5 overflow-x-auto px-5">{children}</div>;
}

export const th = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium text-[var(--muted)] first:pl-0";
export const thNumber = "whitespace-nowrap px-3 py-2 text-right text-[11px] font-medium text-[var(--muted)]";
export const td = "whitespace-nowrap px-3 py-2.5 first:pl-0";
export const tdNumber = "tabular-figures whitespace-nowrap px-3 py-2.5 text-right";

export function Pager({ page, count, pageSize, href }: { page: number; count: number; pageSize: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
      <span>Page {page} of {pages}</span>
      <span className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-[var(--foreground)] hover:bg-[var(--card-raised)]">Newer</Link>}
        {page < pages && <Link href={href(page + 1)} className="rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-[var(--foreground)] hover:bg-[var(--card-raised)]">Older</Link>}
      </span>
    </nav>
  );
}

const KIND_TONE: Record<AccountEventKind, string> = {
  ORDER_PLACED: "border-[var(--border-strong)] text-[var(--muted)]",
  ORDER_MODIFIED: "border-[var(--border-strong)] text-[var(--muted)]",
  ORDER_CANCELLED: "border-[var(--border-strong)] text-[var(--muted)]",
  ORDER_REJECTED: "border-[var(--warning)]/50 text-[var(--warning)]",
  ORDER_REFUSED: "border-[var(--warning)]/50 text-[var(--warning)]",
  BREACH: "border-[var(--danger)]/50 text-[var(--danger)]",
  PASSED: "border-[var(--primary)]/50 text-[var(--primary)]",
};

export function KindBadge({ kind }: { kind: AccountEventKind }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${KIND_TONE[kind]}`}>{EVENT_LABELS[kind]}</span>;
}

type Detail = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");
const price = (value: unknown) => (typeof value === "number" ? formatPaise(value, 2) : null);

/** One audit event in a line of plain English. */
export function eventSummary(kind: AccountEventKind, raw: unknown): string {
  const detail = (raw && typeof raw === "object" ? raw : {}) as Detail;
  const order = `${text(detail.side) === "BUY" ? "Buy" : "Sell"} ${text(detail.lots)} ${detail.lots === 1 ? "lot" : "lots"} ${text(detail.tradingSymbol)}`;
  const limits = [price(detail.limitPrice) && `limit ${price(detail.limitPrice)}`, price(detail.triggerPrice) && `trigger ${price(detail.triggerPrice)}`].filter(Boolean).join(", ");
  const exit = detail.exit === "stop" ? " (stop-loss)" : detail.exit === "target" ? " (target)" : "";
  switch (kind) {
    case "ORDER_PLACED":
      return `${order}, ${text(detail.type).toLowerCase()}${limits ? ` at ${limits}` : ""}${exit}`;
    case "ORDER_REJECTED":
    case "ORDER_REFUSED":
      return `${order}: ${text(detail.reason) || "refused"}`;
    case "ORDER_CANCELLED":
      return `${text(detail.tradingSymbol)} ${text(detail.side).toLowerCase()} cancelled, ${text(detail.filled)} of ${text(detail.quantity)} units filled${detail.reason ? `: ${text(detail.reason)}` : ""}`;
    case "ORDER_MODIFIED": {
      const from = (detail.from ?? {}) as Detail;
      const to = (detail.to ?? {}) as Detail;
      const changes = [
        from.lots !== to.lots && `lots ${text(from.lots)} → ${text(to.lots)}`,
        from.limitPrice !== to.limitPrice && `limit ${price(from.limitPrice) ?? "none"} → ${price(to.limitPrice) ?? "none"}`,
        from.triggerPrice !== to.triggerPrice && `trigger ${price(from.triggerPrice) ?? "none"} → ${price(to.triggerPrice) ?? "none"}`,
      ].filter(Boolean);
      return `${text(detail.tradingSymbol)}: ${changes.join(", ") || "changed"}`;
    }
    case "BREACH": {
      const rules = Array.isArray(detail.rules) ? detail.rules : [];
      const names = rules.map((rule) => (rule === "DAILY_LOSS" ? "daily loss limit" : "max drawdown")).join(" and ");
      return `${names ? names[0].toUpperCase() + names.slice(1) : "A limit"} hit at equity ${rupees(typeof detail.equity === "number" ? detail.equity : null, 2)}`;
    }
    case "PASSED":
      return `Passed on ${text(detail.date)} with ${rupees(typeof detail.profit === "number" ? detail.profit : null)} profit over ${text(detail.tradingDays)} trading days`;
  }
}

/** A meter for how much of a limit is used: the accent, then warning, then danger. */
export function LimitBar({ share, label }: { share: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, share));
  const fill = share >= 0.75 ? "bg-[var(--danger)]" : share >= 0.5 ? "bg-[var(--warning)]" : "bg-[var(--primary)]";
  return (
    <div className="min-w-24" title={`${label}: ${percent(share, 0)}`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--card-raised)]" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)}>
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${clamped * 100}%` }} />
      </div>
      <p className="tabular-figures mt-1 text-[10px] text-[var(--muted)]">{percent(share, 0)}</p>
    </div>
  );
}
