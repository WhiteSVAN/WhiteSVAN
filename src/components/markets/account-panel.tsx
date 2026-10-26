"use client";

import { useState } from "react";
import { dayPositions, dayTotals, exitRole, exitsProblem, type Desk, type OrderRecord } from "@/lib/trading/desk";
import { riskMeters, type EngineOutput, type OrderChanges, type OrderType, type WorkingOrder } from "@/lib/trading/engine";
import type { Instrument, Side } from "@/lib/trading/instruments";
import { parseRupees } from "@/lib/trading/money";
import { payoutAmounts } from "@/lib/trading/payouts";
import { toIst } from "@/lib/trading/time";
import type { KiteContract, MarketQuote } from "@/lib/zerodha/kite";
import { STATUS_BADGE } from "@/components/markets/account-status";

/** An order as the platform sends it; the server assigns the id and checks the contract. */
export interface OrderInput {
  token: number;
  side: Side;
  lots: number;
  type: OrderType;
  limitPrice?: number;
  triggerPrice?: number;
  /** A buy's stop-loss trigger and target, placed as sell orders once it fills. */
  stopLoss?: number;
  target?: number;
}

/** "Stop-loss" or "Target" for a buy's exit orders, after the order type. */
const exitTag = (orderId: string) => {
  const role = exitRole(orderId);
  return role === "stop" ? " · Stop-loss" : role === "target" ? " · Target" : "";
};

const priceText = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clockText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const price = (paise: number) => priceText.format(paise / 100);
const rupees = (paise: number) => `₹${price(paise)}`;
const signed = (paise: number) => `${paise > 0 ? "+" : paise < 0 ? "−" : ""}₹${price(Math.abs(paise))}`;
const tone = (paise: number) => (paise > 0 ? "text-[var(--primary)]" : paise < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]");
/** The ticket's order types. Working SL-M orders placed before still show, modify and cancel. */
const ORDER_TYPES: [OrderType, string][] = [["MARKET", "Market"], ["LIMIT", "Limit"], ["SL", "Stop-loss"]];
const needsLimit = (type: OrderType) => type === "LIMIT" || type === "SL";
const needsTrigger = (type: OrderType) => type === "SL" || type === "SL-M";

/** What's wrong with a typed price, or null: it must be positive and on the contract's tick. */
function priceProblem(value: number | null, input: string, tick: number): string | null {
  if (value === null) return input.trim() ? "Enter a price in rupees." : "Required.";
  return value <= 0 || value % tick !== 0 ? `Use a multiple of ₹${(tick / 100).toFixed(2)}.` : null;
}

/** The first rejection among an order's outputs, as the trader should read it. */
const rejectionOf = (outputs: readonly EngineOutput[]) => {
  const rejected = outputs.find((output) => output.kind === "rejected");
  return rejected?.kind === "rejected" ? rejected.message : null;
};

/** One rule meter: a label, its value, a bar of how much is used and a line of detail. */
export function Meter({ label, value, detail, used, danger = false }: { label: string; value: string; detail: string; used: number; danger?: boolean }) {
  const width = `${Math.min(100, Math.max(0, used * 100)).toFixed(1)}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs"><span className="text-[var(--muted)]">{label}</span><span className="font-mono">{value}</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--card-deep)]" aria-hidden="true"><div className={`h-full rounded-full ${danger ? "bg-[var(--danger)]" : "bg-[var(--primary)]"}`} style={{ width }} /></div>
      <p className="mt-1 text-[11px] text-[var(--faint)]">{detail}</p>
    </div>
  );
}

/** "Demo account" while it's an evaluation, "Funded account" once funded. */
export const accountKind = (desk: Desk) => (desk.state.phase === "FUNDED" ? "Funded account" : "Demo account");

/**
 * The account's balance and rule meters, shared by the platform and the dashboard. A demo account
 * (the evaluation) tracks the profit target; a funded account tracks what it can pay out.
 */
export function AccountMeters({ desk, wide = false }: { desk: Desk; wide?: boolean }) {
  const meters = riskMeters(desk.state);
  const { rules } = desk.state;
  const funded = desk.state.phase === "FUNDED";
  const payout = funded ? payoutAmounts(rules, Math.max(0, meters.balance - rules.startingBalance)) : null;
  return (
    <>
      <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 text-xs ${wide ? "sm:grid-cols-4" : ""}`}>
        {[
          ["Balance", rupees(meters.balance), ""],
          ["Equity", rupees(meters.equity), ""],
          ["Open P&L", signed(meters.unrealised), tone(meters.unrealised)],
          ["Today", signed(meters.todayNet + meters.unrealised), tone(meters.todayNet + meters.unrealised)],
        ].map(([term, value, className]) => (
          <div key={term}><dt className="text-[var(--muted)]">{term}</dt><dd className={`mt-0.5 font-mono text-sm ${className}`}>{value}</dd></div>
        ))}
      </dl>
      <div className={wide ? "grid gap-4 sm:grid-cols-3" : "space-y-3"}>
        <Meter label="Daily loss" value={`${rupees(meters.dailyLossUsed)} / ${rupees(meters.dailyLossLimit)}`} detail={`${rupees(meters.dailyLossLeft)} left today, counting open P&L`} used={meters.dailyLossUsed / meters.dailyLossLimit} danger />
        <Meter label="Max drawdown" value={`${rupees(Math.max(0, meters.roomToFloor))} room`} detail={`Floor ${rupees(meters.maxLossFloor)}`} used={1 - Math.max(0, meters.roomToFloor) / rules.maxLoss} danger />
        {payout ? (
          <Meter label="Payout" value={`${rupees(payout.payout)} / ${rupees(rules.payoutCap)}`} detail={`${rules.profitSplitPercent}% of profit above the ${rupees(payout.buffer)} buffer · ${meters.lotsInUse} of ${meters.maxLots} lots in use`} used={payout.payout / rules.payoutCap} />
        ) : (
          <Meter label="Profit target" value={`${rupees(Math.max(0, meters.profit))} / ${rupees(meters.profitTarget)}`} detail={`${meters.tradingDays} of ${meters.minTradingDays} trading days · ${meters.lotsInUse} of ${meters.maxLots} lots in use`} used={meters.profit / meters.profitTarget} />
        )}
      </div>
      {desk.state.breach && (
        <p role="alert" className="rounded-md border border-[var(--danger)]/40 p-3 text-xs leading-5 text-[var(--danger)]">
          {desk.state.breach.rules.map((rule) => (rule === "DAILY_LOSS" ? "Daily loss limit" : "Max drawdown")).join(" and ")} hit on {desk.state.breach.date} at equity {rupees(desk.state.breach.equity)}. The account is closed to new orders.
        </p>
      )}
      {desk.state.status === "PASSED" && (
        <p role="status" className="rounded-md border border-[var(--primary)]/40 p-3 text-xs leading-5 text-[var(--primary)]">Passed on {desk.state.passedOn}. Your funded account is open in My accounts.</p>
      )}
    </>
  );
}

/**
 * The order ticket for the selected option (`label` names it), under the account's name and
 * status. The side is the caller's, so the option chain's Buy and Sell can set it.
 */
export function AccountTicket({ desk, planLabel, contract, label, quote, side, onSide, onPlace }: { desk: Desk; planLabel: string; contract: KiteContract | null; label: string | null; quote: MarketQuote | undefined; side: Side; onSide: (side: Side) => void; onPlace: (order: OrderInput) => Promise<EngineOutput[]> }) {
  const [type, setType] = useState<OrderType>("MARKET");
  const [lots, setLots] = useState(1);
  const [limitInput, setLimitInput] = useState("");
  const [triggerInput, setTriggerInput] = useState("");
  const [exitsOn, setExitsOn] = useState(false);
  const [stopInput, setStopInput] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null);

  const { rules } = desk.state;
  const status = STATUS_BADGE[desk.state.status];
  const withLimit = needsLimit(type);
  const withTrigger = needsTrigger(type);
  const limit = withLimit ? parseRupees(limitInput, 7) : null;
  const trigger = withTrigger ? parseRupees(triggerInput, 7) : null;
  const tick = contract?.tickSize ?? 5;
  const limitProblem = withLimit ? priceProblem(limit, limitInput, tick) : null;
  const triggerProblem = withTrigger ? priceProblem(trigger, triggerInput, tick) : null;
  // A buy can carry a stop-loss and target, checked against where it should fill.
  const withExits = side === "BUY" && exitsOn;
  const stop = withExits && stopInput.trim() ? parseRupees(stopInput, 7) : null;
  const target = withExits && targetInput.trim() ? parseRupees(targetInput, 7) : null;
  const expected = type === "MARKET" ? quote?.lastPrice : type === "LIMIT" ? limit ?? undefined : trigger ?? undefined;
  const exitsError = !withExits ? null
    : stopInput.trim() && stop === null ? "Enter the stop-loss in rupees."
    : targetInput.trim() && target === null ? "Enter the target in rupees."
    : exitsProblem({ stop: stop ?? undefined, target: target ?? undefined }, side, expected, tick);
  const ready = contract && desk.state.status === "ACTIVE" && !pending && !limitProblem && !triggerProblem && !exitsError;
  const typeName = ORDER_TYPES.find(([value]) => value === type)?.[1] ?? type;
  const action = `${side === "BUY" ? "Buy" : "Sell"} ${lots} lot${lots === 1 ? "" : "s"}${type === "MARKET" ? " at market" : ` · ${typeName}`}`;

  const submit = async () => {
    if (!contract || !ready) return;
    setPending(true);
    setResult(null);
    try {
      const outputs = await onPlace({
        token: contract.token,
        side,
        lots,
        type,
        ...(withLimit && limit !== null ? { limitPrice: limit } : {}),
        ...(withTrigger && trigger !== null ? { triggerPrice: trigger } : {}),
        ...(withExits && stop !== null ? { stopLoss: stop } : {}),
        ...(withExits && target !== null ? { target } : {}),
      });
      const rejected = rejectionOf(outputs);
      // The buy's own fills; its stop-loss and target are reported after them.
      const fills = outputs.flatMap((output) => (output.kind === "fill" && output.fill.reason === "ORDER" && !exitRole(output.fill.orderId ?? "") ? [output.fill] : []));
      const exits = outputs.flatMap((output) => (output.kind === "accepted" && exitRole(output.orderId) ? [exitRole(output.orderId)] : []));
      const working = exits.length === 2 ? " Stop-loss and target working." : exits[0] === "stop" ? " Stop-loss working." : exits[0] === "target" ? " Target working." : "";
      const asked = withExits && (stop !== null || target !== null);
      if (rejected && fills.length === 0) setResult({ tone: "bad", text: rejected });
      else if (fills.length > 0) {
        const units = fills.reduce((sum, fill) => sum + fill.quantity, 0);
        const average = Math.round(fills.reduce((sum, fill) => sum + fill.price * fill.quantity, 0) / units);
        setResult({ tone: "good", text: `Filled ${units} at ${rupees(average)}${fills.length > 1 ? " average" : ""}.${working}${asked && !working ? " Check the activity for the stop-loss and target." : ""}` });
      } else if (outputs.some((output) => output.kind === "accepted")) setResult({ tone: "info", text: `Order working. It fills when the market reaches your price${asked ? ", then the stop-loss and target go in" : ""}.` });
      else setResult({ tone: "bad", text: "No price for this contract yet. Try again in a moment." });
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : "Couldn't place the order. Try again." });
    } finally {
      setPending(false);
    }
  };

  const field = "mt-1 min-h-10 w-full rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-3 font-mono text-sm text-[var(--foreground)]";
  const bestBid = quote?.bids[0]?.price;
  const bestAsk = quote?.asks[0]?.price;

  return (
    <aside id="order-ticket" className="terminal-card flex scroll-mt-24 flex-col gap-5 p-5" aria-label="Account and order ticket">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="terminal-label">{accountKind(desk)}</p>
          <p className="mt-1 text-sm font-medium">{planLabel} · {rules.maxLots} lot{rules.maxLots === 1 ? "" : "s"}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${status.className}`}>{status.text}</span>
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        {contract ? (
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-3">
            <div>
              <p className="font-mono text-sm">{label}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">Lot {contract.lotSize} · {bestBid !== undefined && bestAsk !== undefined ? <>bid <span className="font-mono text-[var(--primary)]">{price(bestBid)}</span> · ask <span className="font-mono text-[var(--danger)]">{price(bestAsk)}</span></> : "waiting for prices"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Side">
              {(["BUY", "SELL"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={side === value} onClick={() => onSide(value)} className={`min-h-10 rounded-md border text-sm font-medium ${side === value ? (value === "BUY" ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--danger)] bg-[var(--danger)] text-[var(--danger-foreground)]") : "border-[var(--border-strong)] text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                  {value === "BUY" ? "Buy" : "Sell"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-1" role="group" aria-label="Order type">
              {ORDER_TYPES.map(([value, text]) => (
                <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)} className={`min-h-8 flex-1 whitespace-nowrap rounded-md px-2 font-mono text-xs ${type === value ? "bg-[var(--card-raised)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>{text}</button>
              ))}
            </div>
            <label className="block text-xs text-[var(--muted)]">Lots ({lots * contract.lotSize} units)
              <input id="ticket-lots" type="number" min={1} max={rules.maxLots} step={1} value={lots} onChange={(event) => setLots(Math.min(rules.maxLots, Math.max(1, Math.round(Number(event.target.value) || 1))))} className={field} />
            </label>
            {withLimit && (
              <label className="block text-xs text-[var(--muted)]">Limit price (₹)
                <input inputMode="decimal" value={limitInput} onChange={(event) => setLimitInput(event.target.value)} placeholder={quote ? price(quote.lastPrice) : ""} aria-invalid={Boolean(limitInput && limitProblem)} className={field} />
                {limitInput && limitProblem && <span className="mt-1 block text-[var(--danger)]">{limitProblem}</span>}
              </label>
            )}
            {withTrigger && (
              <label className="block text-xs text-[var(--muted)]">Trigger price (₹)
                <input inputMode="decimal" value={triggerInput} onChange={(event) => setTriggerInput(event.target.value)} placeholder={quote ? price(quote.lastPrice) : ""} aria-invalid={Boolean(triggerInput && triggerProblem)} className={field} />
                {triggerInput && triggerProblem && <span className="mt-1 block text-[var(--danger)]">{triggerProblem}</span>}
              </label>
            )}
            {side === "BUY" && (
              <fieldset className="rounded-md border border-[var(--border)] p-3">
                <legend className="sr-only">Stop-loss and target</legend>
                <label className="flex items-center gap-2 text-xs">
                  <input id="ticket-exits" type="checkbox" checked={exitsOn} onChange={(event) => setExitsOn(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                  Add a stop-loss and target
                </label>
                {exitsOn && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="block text-xs text-[var(--muted)]">Stop-loss (₹)
                        <input id="ticket-stop" inputMode="decimal" value={stopInput} onChange={(event) => setStopInput(event.target.value)} aria-invalid={Boolean(exitsError && stopInput)} className={field} />
                      </label>
                      <label className="block text-xs text-[var(--muted)]">Target (₹)
                        <input id="ticket-target" inputMode="decimal" value={targetInput} onChange={(event) => setTargetInput(event.target.value)} aria-invalid={Boolean(exitsError && targetInput)} className={field} />
                      </label>
                    </div>
                    {exitsError && <p className="mt-2 text-xs text-[var(--danger)]">{exitsError}</p>}
                    <p className="mt-2 text-[11px] leading-4 text-[var(--faint)]">Both go in as sell orders once the buy fills. When one fills, the other is cancelled.</p>
                  </>
                )}
              </fieldset>
            )}
            <button type="submit" disabled={!ready} className={`min-h-11 w-full rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${side === "BUY" ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]" : "bg-[var(--danger)] text-[var(--danger-foreground)] hover:opacity-90"}`}>
              {pending ? "Placing…" : action}
            </button>
            <p aria-live="polite" className={`min-h-5 text-xs leading-5 ${result?.tone === "bad" ? "text-[var(--danger)]" : result?.tone === "good" ? "text-[var(--primary)]" : "text-[var(--muted)]"}`}>{result?.text}</p>
          </form>
        ) : (
          <p className="text-xs leading-6 text-[var(--muted)]">Pick an option from the chain to trade it.</p>
        )}
      </div>

      <p className="border-t border-[var(--border)] pt-3 text-xs leading-5 text-[var(--muted)]">Simulated fills against the live order book, with slippage and charges. Buy calls or puts; sell only to close. Keep this page open while you hold positions: orders, stops and the 15:20 square-off run while it&apos;s open.</p>
    </aside>
  );
}

type Tab = "positions" | "orders" | "trades";

const stampText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const STATUS_TEXT: Record<OrderRecord["status"], [string, string]> = {
  OPEN: ["Open", "text-[var(--foreground)]"],
  COMPLETE: ["Complete", "text-[var(--primary)]"],
  CANCELLED: ["Cancelled", "text-[var(--muted)]"],
  REJECTED: ["Rejected", "text-[var(--danger)]"],
};

/** An order's prices as the order book shows them. */
function orderPrice(order: Pick<OrderRecord, "type" | "limitPrice" | "triggerPrice">): string {
  switch (order.type) {
    case "MARKET": return "Market";
    case "LIMIT": return order.limitPrice !== undefined ? price(order.limitPrice) : "—";
    case "SL-M": return order.triggerPrice !== undefined ? `Trig ${price(order.triggerPrice)}` : "—";
    case "SL": return order.triggerPrice !== undefined && order.limitPrice !== undefined ? `Trig ${price(order.triggerPrice)} · ${price(order.limitPrice)}` : "—";
  }
}

/** New lots and prices for a working order, inline in the Orders table. Side and type stay. */
function OrderEditor({ order, instrument, maxLots, onModify, onClose }: { order: WorkingOrder; instrument: Instrument | undefined; maxLots: number; onModify: (orderId: string, changes: OrderChanges) => Promise<EngineOutput[]>; onClose: () => void }) {
  const [lots, setLots] = useState(order.lots);
  const [limitInput, setLimitInput] = useState(order.limitPrice !== undefined ? (order.limitPrice / 100).toFixed(2) : "");
  const [triggerInput, setTriggerInput] = useState(order.triggerPrice !== undefined ? (order.triggerPrice / 100).toFixed(2) : "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const tick = instrument?.tickSize ?? 5;
  const withLimit = needsLimit(order.type);
  const withTrigger = needsTrigger(order.type);
  const limit = withLimit ? parseRupees(limitInput, 7) : null;
  const trigger = withTrigger ? parseRupees(triggerInput, 7) : null;
  const problem = (withLimit ? priceProblem(limit, limitInput, tick) : null) ?? (withTrigger ? priceProblem(trigger, triggerInput, tick) : null);
  // The order can't shrink to what has already filled.
  const minLots = Math.floor(order.filled / (instrument?.lotSize ?? 1)) + 1;

  const save = async () => {
    const changes: OrderChanges = {
      ...(lots !== order.lots ? { lots } : {}),
      ...(limit !== null && limit !== order.limitPrice ? { limitPrice: limit } : {}),
      ...(trigger !== null && trigger !== order.triggerPrice ? { triggerPrice: trigger } : {}),
    };
    if (Object.keys(changes).length === 0) return onClose();
    setPending(true);
    setMessage(null);
    try {
      const rejected = rejectionOf(await onModify(order.id, changes));
      if (rejected) setMessage(rejected);
      else onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That didn't go through. Try again.");
    } finally {
      setPending(false);
    }
  };

  const input = "mt-1 block min-h-9 w-28 rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] px-2 font-mono text-xs text-[var(--foreground)]";
  return (
    <tr className="bg-[var(--card-raised)]">
      <td colSpan={8} className="px-4 py-3">
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} aria-label="Modify order" className="flex flex-wrap items-end gap-3 font-sans text-xs">
          <p className="w-full text-[var(--muted)]">Modify {order.side === "BUY" ? "buy" : "sell"} {order.type} · <span className="font-mono text-[var(--foreground)]">{instrument?.tradingSymbol ?? order.token}</span></p>
          <label className="text-[var(--muted)]">Lots
            <input type="number" min={minLots} max={maxLots} step={1} value={lots} onChange={(event) => setLots(Math.min(maxLots, Math.max(minLots, Math.round(Number(event.target.value) || minLots))))} className={input} />
          </label>
          {withLimit && (
            <label className="text-[var(--muted)]">Limit (₹)
              <input inputMode="decimal" value={limitInput} onChange={(event) => setLimitInput(event.target.value)} className={input} />
            </label>
          )}
          {withTrigger && (
            <label className="text-[var(--muted)]">Trigger (₹)
              <input inputMode="decimal" value={triggerInput} onChange={(event) => setTriggerInput(event.target.value)} className={input} />
            </label>
          )}
          <button type="submit" disabled={pending || Boolean(problem)} className="min-h-9 rounded-md bg-[var(--ink)] px-4 font-medium text-[var(--ink-foreground)] hover:bg-[var(--ink-hover)] disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
          <button type="button" onClick={onClose} className="min-h-9 rounded-md border border-[var(--border-strong)] px-3 hover:bg-[var(--card-deep)]">Back</button>
          {(message ?? problem) && <p role="alert" className="w-full text-[var(--danger)]">{message ?? problem}</p>}
        </form>
      </td>
    </tr>
  );
}

/**
 * The account's book in three tabs: today's positions with their P&L (open and closed, Exit and
 * Exit all), orders (working ones to modify or cancel, then the history) and trades (fills).
 */
export function AccountBlotter({ desk, onCancel, onPlace, onModify }: { desk: Desk; onCancel: (orderId: string) => Promise<void>; onPlace: (order: OrderInput) => Promise<EngineOutput[]>; onModify: (orderId: string, changes: OrderChanges) => Promise<EngineOutput[]> }) {
  const [tab, setTab] = useState<Tab>("positions");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const today = desk.state.day?.date ?? toIst(desk.state.clock).date;
  const positions = dayPositions(desk, today);
  const totals = dayTotals(positions);
  const open = positions.filter((position) => position.quantity !== 0);
  const { orders } = desk.state;
  const history = (desk.orderBook ?? []).filter((record) => record.status !== "OPEN");
  const active = desk.state.status === "ACTIVE";
  const instrumentFor = (token: number) => desk.instruments.find((item) => item.token === token);
  const run = (task: Promise<unknown>) => {
    setError(null);
    task.catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "That didn't go through. Try again."));
  };
  /** A market order that closes the whole position. */
  const exitOrder = (token: number, quantity: number): OrderInput | null => {
    const lotSize = instrumentFor(token)?.lotSize;
    return lotSize && quantity !== 0 ? { token, side: quantity > 0 ? "SELL" : "BUY", lots: Math.abs(quantity) / lotSize, type: "MARKET" } : null;
  };
  const exitAll = async () => {
    setExiting(true);
    setError(null);
    try {
      // Any short left from before goes first, so no exit leaves a naked short behind.
      for (const position of [...open].sort((a, b) => a.quantity - b.quantity)) {
        const order = exitOrder(position.token, position.quantity);
        if (!order) continue;
        const rejected = rejectionOf(await onPlace(order));
        if (rejected) throw new Error(`${position.tradingSymbol}: ${rejected}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't exit every position. Try again.");
    } finally {
      setExiting(false);
    }
  };
  const tabs: [Tab, string, number][] = [
    ["positions", "Positions", open.length],
    ["orders", "Orders", orders.length],
    ["trades", "Trades", desk.fills.length],
  ];
  const cell = "px-4 py-2.5";
  const head = `${cell} font-normal text-[var(--muted)]`;
  const action = "rounded border border-[var(--border-strong)] px-2 py-1 font-sans hover:bg-[var(--card-raised)] disabled:opacity-40";
  const sideText = (side: Side) => <span className={side === "BUY" ? "text-[var(--primary)]" : "text-[var(--danger)]"}>{side === "BUY" ? "Buy" : "Sell"}</span>;
  const average = (value: number, quantity: number) => (quantity > 0 ? price(Math.round(value / quantity)) : "—");
  /** A position's working stop-loss and target, as "SL 100.00 · TP 150.00". */
  const exitsText = (token: number) => {
    const exits = orders.filter((order) => order.token === token && exitRole(order.id));
    const stop = exits.find((order) => exitRole(order.id) === "stop")?.triggerPrice;
    const target = exits.find((order) => exitRole(order.id) === "target")?.limitPrice;
    return stop === undefined && target === undefined ? "—" : [stop !== undefined ? `SL ${price(stop)}` : null, target !== undefined ? `TP ${price(target)}` : null].filter(Boolean).join(" · ");
  };

  return (
    <section className="terminal-card overflow-hidden" aria-label="Positions, orders and trades">
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3 pt-2" role="tablist" aria-label="Positions, orders and trades">
        {tabs.map(([value, label, count]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`min-h-10 shrink-0 border-b-2 px-3 text-xs font-medium ${tab === value ? "border-[var(--primary)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            {label} <span className="font-mono text-[var(--faint)]">{count}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--danger)]">{error}</p>}
      <div className="max-h-[28rem] overflow-auto" role="tabpanel">
        {tab === "positions" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--border)] px-4 py-3">
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs" aria-label="Today's P&L">
                {[
                  ["Realised, after charges", totals.realised - totals.charges],
                  ["Open P&L", totals.unrealised],
                  ["Day P&L", totals.net],
                ].map(([label, value]) => (
                  <div key={label}><dt className="text-[var(--muted)]">{label}</dt><dd className={`mt-0.5 font-mono text-sm ${tone(Number(value))}`}>{signed(Number(value))}</dd></div>
                ))}
              </dl>
              <button type="button" disabled={!active || open.length === 0 || exiting} onClick={() => void exitAll()} className="min-h-9 rounded-md border border-[var(--danger)]/60 px-3 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:cursor-not-allowed disabled:opacity-40">{exiting ? "Exiting…" : "Exit all"}</button>
            </div>
            {positions.length === 0 ? <p className="p-5 text-xs text-[var(--muted)]">No positions today. Buy an option from the chain to open one.</p> : (
              <table className="w-full min-w-[820px] text-left font-mono text-xs">
                <thead><tr>{["Contract", "Net qty", "Bought", "Sold", "LTP", "Stop / target", "P&L", ""].map((label) => <th key={label} scope="col" className={head}>{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {positions.map((position) => {
                    const pnl = position.realised + position.unrealised;
                    const lots = position.lotSize ? position.quantity / position.lotSize : null;
                    const exit = exitOrder(position.token, position.quantity);
                    return (
                      <tr key={position.token} className={position.quantity === 0 ? "text-[var(--muted)]" : ""}>
                        <td className={cell}>{position.tradingSymbol}</td>
                        <td className={`${cell} ${position.quantity > 0 ? "text-[var(--primary)]" : position.quantity < 0 ? "text-[var(--danger)]" : ""}`}>{position.quantity > 0 ? "+" : ""}{position.quantity}{lots !== null && position.quantity !== 0 ? <span className="text-[var(--faint)]"> ({lots} lot{Math.abs(lots) === 1 ? "" : "s"})</span> : null}</td>
                        <td className={cell}>{position.buyQuantity > 0 ? `${position.buyQuantity} @ ${average(position.buyValue, position.buyQuantity)}` : "—"}</td>
                        <td className={cell}>{position.sellQuantity > 0 ? `${position.sellQuantity} @ ${average(position.sellValue, position.sellQuantity)}` : "—"}</td>
                        <td className={cell}>{price(position.mark)}</td>
                        <td className={`${cell} whitespace-nowrap`}>{exitsText(position.token)}</td>
                        <td className={`${cell} ${tone(pnl)}`}>{signed(pnl)}</td>
                        <td className={`${cell} text-right`}>{exit && <button type="button" disabled={!active} onClick={() => run(onPlace(exit))} className={action}>Exit</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {positions.length > 0 && <p className="border-t border-[var(--border)] px-4 py-2.5 text-[11px] leading-5 text-[var(--faint)]">P&amp;L per contract is before charges: what you sold minus what you bought, plus open units at the last price. Charges come off the realised total.</p>}
          </>
        )}
        {tab === "orders" && (
          <>
            {orders.length === 0 ? <p className="border-b border-[var(--border)] p-5 text-xs text-[var(--muted)]">No working orders. Limit and stop-loss orders wait here until they fill.</p> : (
              <table className="w-full min-w-[680px] text-left font-mono text-xs">
                <caption className="px-4 pb-1 pt-3 text-left font-sans text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Working</caption>
                <thead><tr>{["Placed", "Contract", "Side", "Type", "Lots", "Limit", "Trigger", ""].map((label) => <th key={label} scope="col" className={head}>{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {orders.map((order) => editing === order.id ? (
                    <OrderEditor key={order.id} order={order} instrument={instrumentFor(order.token)} maxLots={desk.state.rules.maxLots} onModify={onModify} onClose={() => setEditing(null)} />
                  ) : (
                    <tr key={order.id}>
                      <td className={cell}>{clockText.format(order.placedAt)}</td>
                      <td className={cell}>{instrumentFor(order.token)?.tradingSymbol ?? order.token}</td>
                      <td className={cell}>{sideText(order.side)}</td>
                      <td className={cell}>{order.type}{order.triggered ? " (triggered)" : ""}{exitTag(order.id)}</td>
                      <td className={cell}>{order.lots}{order.filled > 0 ? ` · ${order.filled} filled` : ""}</td>
                      <td className={cell}>{order.limitPrice !== undefined ? price(order.limitPrice) : "—"}</td>
                      <td className={cell}>{order.triggerPrice !== undefined ? price(order.triggerPrice) : "—"}</td>
                      <td className={`${cell} whitespace-nowrap text-right`}>
                        <button type="button" disabled={!active} onClick={() => { setError(null); setEditing(order.id); }} className={`${action} mr-2`}>Modify</button>
                        <button type="button" onClick={() => run(onCancel(order.id))} className={action}>Cancel</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {history.length > 0 && (
              <table className="w-full min-w-[760px] text-left font-mono text-xs">
                <caption className="px-4 pb-1 pt-3 text-left font-sans text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">History</caption>
                <thead><tr>{["Time", "Contract", "Side", "Type", "Qty", "Price", "Avg", "Status"].map((label) => <th key={label} scope="col" className={head}>{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td className={`${cell} whitespace-nowrap`}>{stampText.format(record.updatedAt)}</td>
                      <td className={cell}>{record.tradingSymbol}</td>
                      <td className={cell}>{sideText(record.side)}</td>
                      <td className={cell}>{record.type}{exitTag(record.id)}</td>
                      <td className={cell}>{record.filled}/{record.quantity}</td>
                      <td className={`${cell} whitespace-nowrap`}>{orderPrice(record)}</td>
                      <td className={cell}>{record.averagePrice !== null ? price(record.averagePrice) : "—"}</td>
                      <td className={cell}>
                        <span className={STATUS_TEXT[record.status][1]}>{STATUS_TEXT[record.status][0]}</span>
                        {record.reason && <span className="block max-w-56 font-sans text-[11px] leading-4 text-[var(--faint)]">{record.reason}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        {tab === "trades" && (desk.fills.length === 0 ? <p className="p-5 text-xs text-[var(--muted)]">No trades yet.</p> : (
          <table className="w-full min-w-[640px] text-left font-mono text-xs">
            <thead><tr>{["Time", "Contract", "Side", "Qty", "Price", "Realised", "Charges"].map((label) => <th key={label} scope="col" className={head}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {desk.fills.map((fill) => (
                <tr key={fill.id}>
                  <td className={`${cell} whitespace-nowrap`}>{stampText.format(fill.at)}</td>
                  <td className={cell}>{fill.tradingSymbol}{fill.reason !== "ORDER" ? <span className="text-[var(--faint)]"> · {fill.reason === "SQUARE_OFF" ? "square-off" : "limit hit"}</span> : null}</td>
                  <td className={cell}>{sideText(fill.side)}</td>
                  <td className={cell}>{fill.quantity}</td>
                  <td className={cell}>{price(fill.price)}</td>
                  <td className={`${cell} ${tone(fill.realised)}`}>{fill.realised === 0 ? "—" : signed(fill.realised)}</td>
                  <td className={cell}>{rupees(fill.charges.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}
