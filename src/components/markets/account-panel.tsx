"use client";

import { useState } from "react";
import type { Desk } from "@/lib/trading/desk";
import { positionsView, riskMeters, type EngineOutput, type OrderType } from "@/lib/trading/engine";
import type { Side } from "@/lib/trading/instruments";
import { parseRupees } from "@/lib/trading/money";
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
}

const priceText = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clockText = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const price = (paise: number) => priceText.format(paise / 100);
const rupees = (paise: number) => `₹${price(paise)}`;
const signed = (paise: number) => `${paise > 0 ? "+" : paise < 0 ? "−" : ""}₹${price(Math.abs(paise))}`;
const tone = (paise: number) => (paise > 0 ? "text-[var(--primary)]" : paise < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]");
const ORDER_TYPES: [OrderType, string][] = [["MARKET", "Market"], ["LIMIT", "Limit"], ["SL", "SL"], ["SL-M", "SL-M"]];

function Meter({ label, value, detail, used, danger = false }: { label: string; value: string; detail: string; used: number; danger?: boolean }) {
  const width = `${Math.min(100, Math.max(0, used * 100)).toFixed(1)}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs"><span className="text-[var(--muted)]">{label}</span><span className="font-mono">{value}</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--card-deep)]" aria-hidden="true"><div className={`h-full rounded-full ${danger ? "bg-[var(--danger)]" : "bg-[var(--primary)]"}`} style={{ width }} /></div>
      <p className="mt-1 text-[11px] text-[var(--faint)]">{detail}</p>
    </div>
  );
}

/** The account's balance and rule meters, shared by the platform and the dashboard. */
export function AccountMeters({ desk }: { desk: Desk }) {
  const meters = riskMeters(desk.state);
  const { rules } = desk.state;
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        {[
          ["Balance", rupees(meters.balance), ""],
          ["Equity", rupees(meters.equity), ""],
          ["Open P&L", signed(meters.unrealised), tone(meters.unrealised)],
          ["Today", signed(meters.todayNet + meters.unrealised), tone(meters.todayNet + meters.unrealised)],
        ].map(([term, value, className]) => (
          <div key={term}><dt className="text-[var(--muted)]">{term}</dt><dd className={`mt-0.5 font-mono text-sm ${className}`}>{value}</dd></div>
        ))}
      </dl>
      <div className="space-y-3">
        <Meter label="Daily loss" value={`${rupees(meters.dailyLossUsed)} / ${rupees(meters.dailyLossLimit)}`} detail={`${rupees(meters.dailyLossLeft)} left today, counting open P&L`} used={meters.dailyLossUsed / meters.dailyLossLimit} danger />
        <Meter label="Max drawdown" value={`${rupees(Math.max(0, meters.roomToFloor))} room`} detail={`Floor ${rupees(meters.maxLossFloor)}`} used={1 - Math.max(0, meters.roomToFloor) / rules.maxLoss} danger />
        <Meter label="Profit target" value={`${rupees(Math.max(0, meters.profit))} / ${rupees(meters.profitTarget)}`} detail={`${meters.tradingDays} of ${meters.minTradingDays} trading days · ${meters.lotsInUse} of ${meters.maxLots} lots in use`} used={meters.profit / meters.profitTarget} />
      </div>
      {desk.state.breach && (
        <p role="alert" className="rounded-md border border-[var(--danger)]/40 p-3 text-xs leading-5 text-[var(--danger)]">
          {desk.state.breach.rules.map((rule) => (rule === "DAILY_LOSS" ? "Daily loss limit" : "Max drawdown")).join(" and ")} hit on {desk.state.breach.date} at equity {rupees(desk.state.breach.equity)}. The account is closed to new orders.
        </p>
      )}
      {desk.state.status === "PASSED" && (
        <p role="status" className="rounded-md border border-[var(--primary)]/40 p-3 text-xs leading-5 text-[var(--primary)]">Passed on {desk.state.passedOn}. Next: KYC and your funded trader agreement.</p>
      )}
    </>
  );
}

/** The account's meters and the order ticket for the charted contract. */
export function AccountTicket({ desk, planLabel, contract, quote, onPlace }: { desk: Desk; planLabel: string; contract: KiteContract | null; quote: MarketQuote | undefined; onPlace: (order: OrderInput) => Promise<EngineOutput[]> }) {
  const [side, setSide] = useState<Side>("BUY");
  const [type, setType] = useState<OrderType>("MARKET");
  const [lots, setLots] = useState(1);
  const [limitInput, setLimitInput] = useState("");
  const [triggerInput, setTriggerInput] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null);

  const { rules } = desk.state;
  const status = STATUS_BADGE[desk.state.status];
  const needsLimit = type === "LIMIT" || type === "SL";
  const needsTrigger = type === "SL" || type === "SL-M";
  const limit = needsLimit ? parseRupees(limitInput, 7) : null;
  const trigger = needsTrigger ? parseRupees(triggerInput, 7) : null;
  const tick = contract?.tickSize ?? 5;
  const priceProblem = (value: number | null, input: string) => (value === null ? (input.trim() ? "Enter a price in rupees." : "Required.") : value <= 0 || value % tick !== 0 ? `Use a multiple of ₹${(tick / 100).toFixed(2)}.` : null);
  const limitProblem = needsLimit ? priceProblem(limit, limitInput) : null;
  const triggerProblem = needsTrigger ? priceProblem(trigger, triggerInput) : null;
  const ready = contract && desk.state.status === "ACTIVE" && !pending && !limitProblem && !triggerProblem;
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
        ...(needsLimit && limit !== null ? { limitPrice: limit } : {}),
        ...(needsTrigger && trigger !== null ? { triggerPrice: trigger } : {}),
      });
      const rejected = outputs.find((output) => output.kind === "rejected");
      const fills = outputs.flatMap((output) => (output.kind === "fill" && output.fill.reason === "ORDER" ? [output.fill] : []));
      if (rejected?.kind === "rejected") setResult({ tone: "bad", text: rejected.message });
      else if (fills.length > 0) {
        const units = fills.reduce((sum, fill) => sum + fill.quantity, 0);
        const average = Math.round(fills.reduce((sum, fill) => sum + fill.price * fill.quantity, 0) / units);
        setResult({ tone: "good", text: `Filled ${units} at ${rupees(average)}${fills.length > 1 ? " average" : ""}.` });
      } else if (outputs.some((output) => output.kind === "accepted")) setResult({ tone: "info", text: "Order working. It fills when the market reaches your price." });
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
    <aside className="terminal-card flex flex-col gap-5 p-5" aria-label="Account and order ticket">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="terminal-label">Evaluation account</p>
          <p className="mt-1 text-sm font-medium">{planLabel} · {rules.maxLots} lot{rules.maxLots === 1 ? "" : "s"}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${status.className}`}>{status.text}</span>
      </div>

      <AccountMeters desk={desk} />

      <div className="border-t border-[var(--border)] pt-4">
        {contract ? (
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-3">
            <p className="text-xs text-[var(--muted)]">Lot {contract.lotSize} · {bestBid !== undefined && bestAsk !== undefined ? <>bid <span className="font-mono text-[var(--primary)]">{price(bestBid)}</span> · ask <span className="font-mono text-[var(--danger)]">{price(bestAsk)}</span></> : "waiting for depth"}</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Side">
              {(["BUY", "SELL"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={side === value} onClick={() => setSide(value)} className={`min-h-10 rounded-md border text-sm font-medium ${side === value ? (value === "BUY" ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--danger)] bg-[var(--danger)] text-[#2a0f0a]") : "border-[var(--border-strong)] text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                  {value === "BUY" ? "Buy" : "Sell"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-1" role="group" aria-label="Order type">
              {ORDER_TYPES.map(([value, text]) => (
                <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)} className={`min-h-8 flex-1 rounded-md px-2 font-mono text-xs ${type === value ? "bg-[var(--card-raised)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>{text}</button>
              ))}
            </div>
            <label className="block text-xs text-[var(--muted)]">Lots ({lots * contract.lotSize} units)
              <input type="number" min={1} max={rules.maxLots} step={1} value={lots} onChange={(event) => setLots(Math.min(rules.maxLots, Math.max(1, Math.round(Number(event.target.value) || 1))))} className={field} />
            </label>
            {needsLimit && (
              <label className="block text-xs text-[var(--muted)]">Limit price (₹)
                <input inputMode="decimal" value={limitInput} onChange={(event) => setLimitInput(event.target.value)} placeholder={quote ? price(quote.lastPrice) : ""} aria-invalid={Boolean(limitInput && limitProblem)} className={field} />
                {limitInput && limitProblem && <span className="mt-1 block text-[var(--danger)]">{limitProblem}</span>}
              </label>
            )}
            {needsTrigger && (
              <label className="block text-xs text-[var(--muted)]">Trigger price (₹)
                <input inputMode="decimal" value={triggerInput} onChange={(event) => setTriggerInput(event.target.value)} placeholder={quote ? price(quote.lastPrice) : ""} aria-invalid={Boolean(triggerInput && triggerProblem)} className={field} />
                {triggerInput && triggerProblem && <span className="mt-1 block text-[var(--danger)]">{triggerProblem}</span>}
              </label>
            )}
            <button type="submit" disabled={!ready} className={`min-h-11 w-full rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${side === "BUY" ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]" : "bg-[var(--danger)] text-[#2a0f0a] hover:opacity-90"}`}>
              {pending ? "Placing…" : action}
            </button>
            <p aria-live="polite" className={`min-h-5 text-xs leading-5 ${result?.tone === "bad" ? "text-[var(--danger)]" : result?.tone === "good" ? "text-[var(--primary)]" : "text-[var(--muted)]"}`}>{result?.text}</p>
          </form>
        ) : (
          <p className="text-xs leading-6 text-[var(--muted)]">Pick a futures or options contract above to trade it. Indices can be charted but not traded.</p>
        )}
      </div>

      <p className="border-t border-[var(--border)] pt-3 text-xs leading-5 text-[var(--muted)]">Simulated fills against the live order book, with slippage and charges. Keep this page open while you hold positions: orders, stops and the 15:20 square-off run while it&apos;s open.</p>
    </aside>
  );
}

type Tab = "positions" | "orders" | "fills" | "activity";

/** Positions, working orders, fills and activity for the account. */
export function AccountBlotter({ desk, onCancel, onPlace }: { desk: Desk; onCancel: (orderId: string) => Promise<void>; onPlace: (order: OrderInput) => Promise<EngineOutput[]> }) {
  const [tab, setTab] = useState<Tab>("positions");
  const [error, setError] = useState<string | null>(null);
  const positions = positionsView(desk.state);
  const { orders } = desk.state;
  const instrumentFor = (token: number) => desk.instruments.find((item) => item.token === token);
  const run = (task: Promise<unknown>) => {
    setError(null);
    task.catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "That didn't go through. Try again."));
  };
  const close = (token: number, quantity: number) => {
    const instrument = instrumentFor(token);
    if (!instrument || quantity === 0) return;
    run(onPlace({ token, side: quantity > 0 ? "SELL" : "BUY", lots: Math.abs(quantity) / instrument.lotSize, type: "MARKET" }));
  };
  const tabs: [Tab, string, number][] = [["positions", "Positions", positions.length], ["orders", "Orders", orders.length], ["fills", "Fills", desk.fills.length], ["activity", "Activity", desk.notes.length]];
  const cell = "px-4 py-2.5";
  const head = `${cell} font-normal text-[var(--muted)]`;

  return (
    <section className="terminal-card overflow-hidden" aria-label="Account activity">
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3 pt-2" role="tablist" aria-label="Account activity">
        {tabs.map(([value, label, count]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`min-h-10 shrink-0 border-b-2 px-3 text-xs font-medium ${tab === value ? "border-[var(--primary)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            {label} <span className="font-mono text-[var(--faint)]">{count}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--danger)]">{error}</p>}
      <div className="max-h-80 overflow-auto" role="tabpanel">
        {tab === "positions" && (positions.length === 0 ? <p className="p-5 text-xs text-[var(--muted)]">No open positions.</p> : (
          <table className="w-full min-w-[560px] text-left font-mono text-xs">
            <thead><tr>{["Contract", "Lots", "Avg", "LTP", "P&L", ""].map((label) => <th key={label} scope="col" className={head}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {positions.map((position) => (
                <tr key={position.token}>
                  <td className={cell}>{position.tradingSymbol}</td>
                  <td className={`${cell} ${position.quantity > 0 ? "text-[var(--primary)]" : "text-[var(--danger)]"}`}>{position.lots > 0 ? "+" : ""}{position.lots} <span className="text-[var(--faint)]">({position.quantity})</span></td>
                  <td className={cell}>{price(position.averagePrice)}</td>
                  <td className={cell}>{price(position.mark)}</td>
                  <td className={`${cell} ${tone(position.unrealised)}`}>{signed(position.unrealised)}</td>
                  <td className={`${cell} text-right`}><button type="button" disabled={desk.state.status !== "ACTIVE"} onClick={() => close(position.token, position.quantity)} className="rounded border border-[var(--border-strong)] px-2 py-1 font-sans hover:bg-[var(--card-raised)] disabled:opacity-40">Close</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
        {tab === "orders" && (orders.length === 0 ? <p className="p-5 text-xs text-[var(--muted)]">No working orders.</p> : (
          <table className="w-full min-w-[620px] text-left font-mono text-xs">
            <thead><tr>{["Placed", "Contract", "Side", "Type", "Lots", "Limit", "Trigger", ""].map((label) => <th key={label} scope="col" className={head}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className={cell}>{clockText.format(order.placedAt)}</td>
                  <td className={cell}>{instrumentFor(order.token)?.tradingSymbol ?? order.token}</td>
                  <td className={`${cell} ${order.side === "BUY" ? "text-[var(--primary)]" : "text-[var(--danger)]"}`}>{order.side === "BUY" ? "Buy" : "Sell"}</td>
                  <td className={cell}>{order.type}{order.triggered ? " (triggered)" : ""}</td>
                  <td className={cell}>{order.lots}{order.filled > 0 ? ` · ${order.filled} filled` : ""}</td>
                  <td className={cell}>{order.limitPrice !== undefined ? price(order.limitPrice) : "—"}</td>
                  <td className={cell}>{order.triggerPrice !== undefined ? price(order.triggerPrice) : "—"}</td>
                  <td className={`${cell} text-right`}><button type="button" onClick={() => run(onCancel(order.id))} className="rounded border border-[var(--border-strong)] px-2 py-1 font-sans hover:bg-[var(--card-raised)]">Cancel</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
        {tab === "fills" && (desk.fills.length === 0 ? <p className="p-5 text-xs text-[var(--muted)]">No fills yet.</p> : (
          <table className="w-full min-w-[640px] text-left font-mono text-xs">
            <thead><tr>{["Time", "Contract", "Side", "Qty", "Price", "Realised", "Charges"].map((label) => <th key={label} scope="col" className={head}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {desk.fills.map((fill) => (
                <tr key={fill.id}>
                  <td className={cell}>{clockText.format(fill.at)}</td>
                  <td className={cell}>{fill.tradingSymbol}{fill.reason !== "ORDER" ? <span className="text-[var(--faint)]"> · {fill.reason === "SQUARE_OFF" ? "square-off" : "limit hit"}</span> : null}</td>
                  <td className={`${cell} ${fill.side === "BUY" ? "text-[var(--primary)]" : "text-[var(--danger)]"}`}>{fill.side === "BUY" ? "Buy" : "Sell"}</td>
                  <td className={cell}>{fill.quantity}</td>
                  <td className={cell}>{price(fill.price)}</td>
                  <td className={`${cell} ${tone(fill.realised)}`}>{fill.realised === 0 ? "—" : signed(fill.realised)}</td>
                  <td className={cell}>{rupees(fill.charges.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
        {tab === "activity" && (
          <ol className="divide-y divide-[var(--border)] text-xs">
            {desk.notes.map((note, index) => (
              <li key={`${note.at}-${index}`} className="flex gap-4 px-4 py-2.5">
                <span className="shrink-0 font-mono text-[var(--faint)]">{clockText.format(note.at)}</span>
                <span className={note.tone === "bad" ? "text-[var(--danger)]" : note.tone === "good" ? "text-[var(--primary)]" : "text-[var(--muted)]"}>{note.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
