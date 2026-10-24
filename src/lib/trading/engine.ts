/**
 * Simulated account engine (TRD SIM and RULE; stories S3-02, S4-06). One evaluation or funded
 * account as a deterministic state machine: apply timestamped events (quotes, orders, modifications,
 * cancels, clock ticks, payout debits) and get the next state plus what happened (fills with charges,
 * rejections, breaches, day closes, passes). It reads no clock, draws no random numbers and does
 * no I/O, so replaying the same events reproduces every result (RULE-5). The engine service will
 * host it next to the market-data feed; Postgres keeps the state and outputs.
 */
import { chargesForFill, scheduleFor, type ChargeBreakdown, type ChargesSchedule } from "./charges";
import { exposure, type Holding, type Instrument, type Side } from "./instruments";
import { bookFrom, forceExecutions, walkBook, type Book, type Quote } from "./matching";
import { divRound, type Paise } from "./money";
import { limitBreaches, maxLossFloor, reviewPass, type BreachRule, type DayResult, type RuleSet } from "./rules";
import { istInstant, toIst } from "./time";

export type AccountPhase = "EVALUATION" | "FUNDED";
export type AccountStatus = "ACTIVE" | "PASSED" | "FAILED";
export type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";

const ORDER_TYPES: readonly OrderType[] = ["MARKET", "LIMIT", "SL", "SL-M"];

export interface OrderRequest {
  /** Client order id, unique per account and day. A repeat is rejected, so retries are safe. */
  id: string;
  token: number;
  side: Side;
  lots: number;
  type: OrderType;
  /** LIMIT and SL orders. */
  limitPrice?: Paise;
  /** SL and SL-M orders. */
  triggerPrice?: Paise;
}

/** New terms for a working order; whatever is left out stays. Side and type don't change. */
export interface OrderChanges {
  lots?: number;
  limitPrice?: Paise;
  triggerPrice?: Paise;
}

export interface WorkingOrder extends OrderRequest {
  placedAt: number;
  /** Units ordered and filled so far. */
  quantity: number;
  filled: number;
  triggered: boolean;
  /** A limit order that has met the book once and now waits at its price. */
  resting: boolean;
  /** Filled value and brokerage so far: brokerage is charged per executed order. */
  turnover: Paise;
  brokerage: Paise;
}

export interface OpenLot {
  /** Signed units: positive long, negative short. */
  quantity: number;
  price: Paise;
}

export interface Position {
  instrument: Instrument;
  /** First in, first out; every lot has the same sign. */
  open: OpenLot[];
  /** Last traded price and when it arrived. */
  mark: Paise;
  markAt: number;
}

export type FillReason = "ORDER" | "SQUARE_OFF" | "BREACH";

export interface Fill {
  id: string;
  /** Null for automatic exits (square-off or breach). */
  orderId: string | null;
  reason: FillReason;
  token: number;
  tradingSymbol: string;
  side: Side;
  /** Units. */
  quantity: number;
  price: Paise;
  at: number;
  /** Gross P&L this fill closed. */
  realised: Paise;
  charges: ChargeBreakdown;
  chargesSchedule: string;
  balanceAfter: Paise;
}

export interface TradingDay {
  date: string;
  openingBalance: Paise;
  traded: boolean;
  squaredOff: boolean;
  closed: boolean;
  orderIds: string[];
}

export interface PositionView {
  token: number;
  tradingSymbol: string;
  quantity: number;
  lots: number;
  averagePrice: Paise;
  mark: Paise;
  unrealised: Paise;
}

export type BreachTrigger =
  | { kind: "fill"; fillId: string; orderId: string | null; tradingSymbol: string; side: Side; quantity: number; price: Paise }
  | { kind: "quote"; token: number; tradingSymbol: string; lastPrice: Paise };

/** RULE-4: the rule, the values, the rule version and the trade or price that hit the limit. */
export interface BreachReport {
  rules: BreachRule[];
  at: number;
  date: string;
  ruleVersion: string;
  equity: Paise;
  dayOpeningBalance: Paise;
  dailyLossLimit: Paise;
  maxLossFloor: Paise;
  trigger: BreachTrigger;
  /** Open positions at the moment of the breach, before they were closed. */
  positions: PositionView[];
}

export interface AccountState {
  id: string;
  phase: AccountPhase;
  status: AccountStatus;
  /** The rulebook bound at purchase (RULE-1). */
  rules: RuleSet;
  /** Starting balance plus realised P&L, net of charges and payout debits. */
  balance: Paise;
  /** Highest end-of-day balance, starting balance included. */
  highWaterEod: Paise;
  day: TradingDay | null;
  /** Closed trading days with at least one fill. */
  days: DayResult[];
  positions: Position[];
  orders: WorkingOrder[];
  fillCount: number;
  breach: BreachReport | null;
  passedOn: string | null;
  /** Time of the last applied event. */
  clock: number;
}

export interface EngineContext {
  /** Today's tradable contracts (the scoped contract master). */
  instrument(token: number): Instrument | undefined;
  /** Latest quote per contract; the host updates it before dispatching a quote event. */
  quote(token: number): Quote | undefined;
  /** Exchange trading calendar. */
  isTradingDay(date: string): boolean;
  charges: readonly ChargesSchedule[];
  /** Ticks of slippage on market fills. */
  slippageTicks: number;
  /** A quote older than this is stale (TRD MD-3). */
  staleAfterMs: number;
}

export type EngineEvent =
  | { kind: "quote"; at: number; quote: Quote }
  | { kind: "place"; at: number; order: OrderRequest }
  | { kind: "modify"; at: number; orderId: string; changes: OrderChanges }
  | { kind: "cancel"; at: number; orderId: string }
  | { kind: "clock"; at: number }
  | { kind: "payout"; at: number; debit: Paise };

export type RejectReason =
  | "ACCOUNT_LOCKED"
  | "MARKET_CLOSED"
  | "DUPLICATE_ORDER_ID"
  | "INVALID_ORDER"
  | "UNKNOWN_INSTRUMENT"
  | "INVALID_QUANTITY"
  | "FREEZE_QUANTITY"
  | "INVALID_PRICE"
  | "NO_QUOTE"
  | "STALE_QUOTE"
  | "TRIGGER_ALREADY_CROSSED"
  | "EXPIRY_WINDOW"
  | "LOT_LIMIT"
  | "NAKED_SHORT"
  | "UNKNOWN_ORDER"
  | "BELOW_FILLED";

export type CancelReason = "TRADER" | "SQUARE_OFF" | "BREACH" | "LOT_LIMIT" | "NAKED_SHORT";

export type EngineOutput =
  | { kind: "accepted"; at: number; orderId: string }
  | { kind: "modified"; at: number; orderId: string }
  | { kind: "rejected"; at: number; orderId: string; reason: RejectReason; message: string }
  | { kind: "triggered"; at: number; orderId: string }
  | { kind: "fill"; fill: Fill }
  | { kind: "cancelled"; at: number; orderId: string; reason: CancelReason; filled: number }
  | { kind: "breach"; report: BreachReport }
  | { kind: "day-closed"; at: number; date: string; net: Paise; balance: Paise; maxLossFloor: Paise; tradingDays: number }
  | { kind: "passed"; at: number; date: string; balance: Paise; profit: Paise; tradingDays: number }
  | { kind: "payout-debited"; at: number; debit: Paise; balance: Paise };

const hhmm = (second: number) =>
  `${String(Math.floor(second / 3600)).padStart(2, "0")}:${String(Math.floor((second % 3600) / 60)).padStart(2, "0")}`;

export function rejectMessage(reason: RejectReason, rules: RuleSet): string {
  switch (reason) {
    case "ACCOUNT_LOCKED": return "This account is closed to new orders.";
    case "MARKET_CLOSED": return `Orders are accepted from ${hhmm(rules.session.open)} to ${hhmm(rules.session.squareOff)} IST on trading days.`;
    case "DUPLICATE_ORDER_ID": return "This order was already received.";
    case "INVALID_ORDER": return "Choose buy or sell and a market, limit, SL or SL-M order.";
    case "UNKNOWN_INSTRUMENT": return "This contract isn't tradable in the programme.";
    case "INVALID_QUANTITY": return "Order size must be a whole number of lots.";
    case "FREEZE_QUANTITY": return "Order size is above the exchange freeze quantity.";
    case "INVALID_PRICE": return "Use positive prices in multiples of the tick size, with an SL limit on the far side of its trigger.";
    case "NO_QUOTE": return "There's no price for this contract yet.";
    case "STALE_QUOTE": return "Prices for this contract are delayed, so new orders are paused.";
    case "TRIGGER_ALREADY_CROSSED": return "The market is already through this trigger price.";
    case "EXPIRY_WINDOW": return "No new positions in expiring contracts in the last hour of expiry day.";
    case "LOT_LIMIT": return `This order would take you over your ${rules.maxLots}-lot position limit.`;
    case "NAKED_SHORT": return "Sell options only inside a defined-risk spread: hold the protective option first.";
    case "UNKNOWN_ORDER": return "This order isn't working any more: it has filled or been cancelled.";
    case "BELOW_FILLED": return "That's no more than has already filled. Cancel the order to stop the rest.";
  }
}

export function openAccount(input: { id: string; phase: AccountPhase; rules: RuleSet; at: number }): AccountState {
  return {
    id: input.id,
    phase: input.phase,
    status: "ACTIVE",
    rules: structuredClone(input.rules),
    balance: input.rules.startingBalance,
    highWaterEod: input.rules.startingBalance,
    day: null,
    days: [],
    positions: [],
    orders: [],
    fillCount: 0,
    breach: null,
    passedOn: null,
    clock: input.at,
  };
}

/** Apply one event. Never mutates `previous`. Events must arrive in time order. */
export function step(previous: AccountState, event: EngineEvent, context: EngineContext): { state: AccountState; outputs: EngineOutput[] } {
  if (!Number.isFinite(event.at) || event.at < previous.clock) throw new RangeError("Events must be applied in time order.");
  const state = structuredClone(previous);
  const run = new Run(state, context, event.at);
  run.apply(event);
  state.clock = event.at;
  return { state, outputs: run.outputs };
}

export interface ReplaySetup {
  instruments: readonly Instrument[];
  isTradingDay(date: string): boolean;
  charges: readonly ChargesSchedule[];
  slippageTicks: number;
  staleAfterMs: number;
  /** Latest quotes already known when replay starts from a stored snapshot. */
  quotes?: readonly Quote[];
}

/** Re-run an account over recorded events from its opening state or a snapshot (RULE-5, appeals). */
export function replay(initial: AccountState, events: readonly EngineEvent[], setup: ReplaySetup): { state: AccountState; outputs: EngineOutput[] } {
  const instruments = new Map(setup.instruments.map((instrument) => [instrument.token, instrument]));
  const quotes = new Map<number, Quote>((setup.quotes ?? []).map((quote) => [quote.token, quote]));
  const context: EngineContext = {
    instrument: (token) => instruments.get(token),
    quote: (token) => quotes.get(token),
    isTradingDay: setup.isTradingDay,
    charges: setup.charges,
    slippageTicks: setup.slippageTicks,
    staleAfterMs: setup.staleAfterMs,
  };
  let state = initial;
  const outputs: EngineOutput[] = [];
  for (const event of events) {
    if (event.kind === "quote") quotes.set(event.quote.token, event.quote);
    const result = step(state, event, context);
    state = result.state;
    outputs.push(...result.outputs);
  }
  return { state, outputs };
}

export function netQuantity(position: Position): number {
  return position.open.reduce((sum, lot) => sum + lot.quantity, 0);
}

export function unrealisedPnl(position: Position): Paise {
  return position.open.reduce((sum, lot) => sum + (position.mark - lot.price) * lot.quantity, 0);
}

/** Apply signed units at a price, closing open lots first in, first out. Returns realised P&L. */
export function applyFill(position: Position, signedQuantity: number, price: Paise): Paise {
  let remaining = signedQuantity;
  let realised = 0;
  while (remaining !== 0 && position.open.length > 0 && Math.sign(position.open[0].quantity) !== Math.sign(remaining)) {
    const lot = position.open[0];
    const direction = Math.sign(lot.quantity);
    const closing = Math.min(Math.abs(remaining), Math.abs(lot.quantity));
    realised += direction * (price - lot.price) * closing;
    lot.quantity -= direction * closing;
    remaining += direction * closing;
    if (lot.quantity === 0) position.open.shift();
  }
  if (remaining !== 0) position.open.push({ quantity: remaining, price });
  return realised;
}

export function positionsView(state: AccountState): PositionView[] {
  return state.positions.map((position) => {
    const quantity = netQuantity(position);
    const cost = position.open.reduce((sum, lot) => sum + lot.price * lot.quantity, 0);
    return {
      token: position.instrument.token,
      tradingSymbol: position.instrument.tradingSymbol,
      quantity,
      lots: quantity / position.instrument.lotSize,
      averagePrice: quantity === 0 ? 0 : divRound(Math.abs(cost), Math.abs(quantity)),
      mark: position.mark,
      unrealised: unrealisedPnl(position),
    };
  });
}

export interface RiskMeters {
  status: AccountStatus;
  balance: Paise;
  equity: Paise;
  unrealised: Paise;
  /** Realised net P&L so far today. */
  todayNet: Paise;
  maxLossFloor: Paise;
  /** Equity left above the max-drawdown floor. */
  roomToFloor: Paise;
  dailyLossLimit: Paise;
  dailyLossUsed: Paise;
  dailyLossLeft: Paise;
  profit: Paise;
  profitTarget: Paise;
  tradingDays: number;
  minTradingDays: number;
  bestDay: Paise;
  bestDayAllowed: Paise;
  consistencyMet: boolean;
  lotsInUse: number;
  maxLots: number;
}

/** Live meters for the trader dashboard (story S5-02), all computed here, none in the browser. */
export function riskMeters(state: AccountState): RiskMeters {
  const unrealised = state.positions.reduce((sum, position) => sum + unrealisedPnl(position), 0);
  const equity = state.balance + unrealised;
  const opening = state.day && !state.day.closed ? state.day.openingBalance : state.balance;
  const floor = maxLossFloor(state.rules, state.highWaterEod);
  const dailyLossUsed = Math.max(0, opening - equity);
  const review = reviewPass(state.rules, state.balance, state.days);
  return {
    status: state.status,
    balance: state.balance,
    equity,
    unrealised,
    todayNet: state.balance - opening,
    maxLossFloor: floor,
    roomToFloor: equity - floor,
    dailyLossLimit: state.rules.dailyLoss,
    dailyLossUsed,
    dailyLossLeft: Math.max(0, state.rules.dailyLoss - dailyLossUsed),
    profit: review.profit,
    profitTarget: state.rules.profitTarget,
    tradingDays: review.tradingDays,
    minTradingDays: state.rules.minTradingDays,
    bestDay: review.bestDay,
    bestDayAllowed: review.bestDayAllowed,
    consistencyMet: review.consistencyMet,
    lotsInUse: exposure(holdingsOf(state)).lots,
    maxLots: state.rules.maxLots,
  };
}

function holdingsOf(state: AccountState): Holding[] {
  return state.positions.map((position) => ({ instrument: position.instrument, quantity: netQuantity(position) }));
}

const isStop = (order: OrderRequest) => order.type === "SL" || order.type === "SL-M";

function pricesValid(order: OrderRequest, instrument: Instrument): boolean {
  const valid = (price: Paise | undefined): price is Paise =>
    price !== undefined && Number.isSafeInteger(price) && price > 0 && price % instrument.tickSize === 0;
  switch (order.type) {
    case "MARKET": return true;
    case "LIMIT": return valid(order.limitPrice);
    case "SL-M": return valid(order.triggerPrice);
    case "SL":
      return valid(order.limitPrice) && valid(order.triggerPrice)
        && (order.side === "BUY" ? order.limitPrice >= order.triggerPrice : order.limitPrice <= order.triggerPrice);
  }
}

interface Ledger {
  turnover: Paise;
  brokerage: Paise;
}

/** One event's work against a cloned state. */
class Run {
  readonly outputs: EngineOutput[] = [];
  private readonly books = new Map<number, Book | null>();
  private lastFill: Fill | null = null;

  constructor(private readonly s: AccountState, private readonly ctx: EngineContext, private readonly at: number) {}

  apply(event: EngineEvent) {
    if (event.kind === "quote") this.books.set(event.quote.token, bookFrom(event.quote));
    this.advanceClock();
    switch (event.kind) {
      case "quote": return this.onQuote(event.quote);
      case "place": return this.place(event.order);
      case "modify": return this.modify(event.orderId, event.changes);
      case "cancel": return this.cancel(event.orderId);
      case "payout": return this.payout(event.debit);
      case "clock": return;
    }
  }

  /** Square off at 15:20, close the day at 15:30 and open the next trading day. */
  private advanceClock() {
    const { s } = this;
    const now = toIst(this.at);
    const session = s.rules.session;
    if (s.day && s.day.date !== now.date) {
      // Missed clock ticks: exit at that day's 15:20 at the last prices seen that day.
      this.squareOff(istInstant(s.day.date, session.squareOff), "mark");
      this.closeDay();
    }
    if (s.status === "ACTIVE" && (!s.day || s.day.date !== now.date) && this.ctx.isTradingDay(now.date)) {
      s.day = { date: now.date, openingBalance: s.balance, traded: false, squaredOff: false, closed: false, orderIds: [] };
    }
    if (s.day?.date === now.date) {
      if (now.second >= session.squareOff) this.squareOff(this.at, "book");
      if (now.second >= session.close) this.closeDay();
    }
  }

  private squareOff(at: number, pricing: "book" | "mark") {
    const day = this.s.day;
    if (!day || day.squaredOff) return;
    day.squaredOff = true;
    this.cancelAll("SQUARE_OFF", at);
    if (this.s.positions.length === 0) return;
    this.flatten("SQUARE_OFF", at, pricing);
    this.checkLimits(at, () => this.fillTrigger());
  }

  private closeDay() {
    const { s } = this;
    const day = s.day;
    if (!day || day.closed) return;
    this.squareOff(this.at, "book");
    day.closed = true;
    const net = s.balance - day.openingBalance;
    if (day.traded) s.days.push({ date: day.date, net });
    s.highWaterEod = Math.max(s.highWaterEod, s.balance);
    this.outputs.push({
      kind: "day-closed",
      at: this.at,
      date: day.date,
      net,
      balance: s.balance,
      maxLossFloor: maxLossFloor(s.rules, s.highWaterEod),
      tradingDays: s.days.length,
    });
    if (s.phase === "EVALUATION" && s.status === "ACTIVE") {
      const review = reviewPass(s.rules, s.balance, s.days);
      if (review.passed) {
        s.status = "PASSED";
        s.passedOn = day.date;
        this.outputs.push({ kind: "passed", at: this.at, date: day.date, balance: s.balance, profit: review.profit, tradingDays: review.tradingDays });
      }
    }
  }

  private place(order: OrderRequest) {
    const { s, ctx } = this;
    const reject = (reason: RejectReason) => {
      this.outputs.push({ kind: "rejected", at: this.at, orderId: order.id, reason, message: rejectMessage(reason, s.rules) });
    };
    if (s.status !== "ACTIVE") return reject("ACCOUNT_LOCKED");
    const now = toIst(this.at);
    const { session } = s.rules;
    const day = s.day;
    if (!day || day.date !== now.date || day.squaredOff || now.second < session.open || now.second >= session.squareOff) {
      return reject("MARKET_CLOSED");
    }
    if (day.orderIds.includes(order.id)) return reject("DUPLICATE_ORDER_ID");
    day.orderIds.push(order.id);
    if (!ORDER_TYPES.includes(order.type) || (order.side !== "BUY" && order.side !== "SELL")) return reject("INVALID_ORDER");
    const instrument = ctx.instrument(order.token);
    if (!instrument) return reject("UNKNOWN_INSTRUMENT");
    if (!Number.isSafeInteger(order.lots) || order.lots < 1) return reject("INVALID_QUANTITY");
    const quantity = order.lots * instrument.lotSize;
    if (quantity > instrument.freezeQuantity) return reject("FREEZE_QUANTITY");
    if (!pricesValid(order, instrument)) return reject("INVALID_PRICE");
    const book = this.book(order.token);
    if (!book) return reject("NO_QUOTE");
    if (this.at - book.at > ctx.staleAfterMs) return reject("STALE_QUOTE");
    if (isStop(order) && (order.side === "BUY" ? book.lastPrice >= order.triggerPrice! : book.lastPrice <= order.triggerPrice!)) {
      return reject("TRIGGER_ALREADY_CROSSED");
    }
    const signed = order.side === "BUY" ? quantity : -quantity;
    const held = this.netUnits(order.token);
    const reducing = held !== 0 && Math.sign(signed) !== Math.sign(held) && Math.abs(signed) <= Math.abs(held);
    if (!reducing && instrument.expiry === now.date && now.second >= session.expiryCutoff) return reject("EXPIRY_WINDOW");
    const violation = this.exposureViolation(instrument, signed);
    if (violation) return reject(violation);

    const working: WorkingOrder = {
      id: order.id,
      token: order.token,
      side: order.side,
      lots: order.lots,
      type: order.type,
      ...(order.type === "LIMIT" || order.type === "SL" ? { limitPrice: order.limitPrice } : {}),
      ...(isStop(order) ? { triggerPrice: order.triggerPrice } : {}),
      placedAt: this.at,
      quantity,
      filled: 0,
      triggered: false,
      resting: false,
      turnover: 0,
      brokerage: 0,
    };
    s.orders.push(working);
    this.outputs.push({ kind: "accepted", at: this.at, orderId: order.id });
    this.work(working);
    this.checkLimits(this.at, () => this.fillTrigger());
  }

  /**
   * New lots or prices for a working order, checked as a new order would be: what is still unfilled
   * counts against the limits as if it filled now. A new price is worked against the book straight
   * away; a new size waits for the next quote, since this book's depth may be what it filled from.
   */
  private modify(orderId: string, changes: OrderChanges) {
    const { s, ctx } = this;
    const reject = (reason: RejectReason) => {
      this.outputs.push({ kind: "rejected", at: this.at, orderId, reason, message: rejectMessage(reason, s.rules) });
    };
    const order = s.orders.find((candidate) => candidate.id === orderId);
    if (!order) return reject("UNKNOWN_ORDER");
    if (s.status !== "ACTIVE") return reject("ACCOUNT_LOCKED");
    const now = toIst(this.at);
    const { session } = s.rules;
    const day = s.day;
    if (!day || day.date !== now.date || day.squaredOff || now.second < session.open || now.second >= session.squareOff) {
      return reject("MARKET_CLOSED");
    }
    const instrument = ctx.instrument(order.token);
    if (!instrument) return reject("UNKNOWN_INSTRUMENT");
    const lots = changes.lots ?? order.lots;
    if (!Number.isSafeInteger(lots) || lots < 1) return reject("INVALID_QUANTITY");
    const quantity = lots * instrument.lotSize;
    if (quantity > instrument.freezeQuantity) return reject("FREEZE_QUANTITY");
    if (quantity <= order.filled) return reject("BELOW_FILLED");
    const next: OrderRequest = {
      id: order.id,
      token: order.token,
      side: order.side,
      lots,
      type: order.type,
      ...(order.type === "LIMIT" || order.type === "SL" ? { limitPrice: changes.limitPrice ?? order.limitPrice } : {}),
      ...(isStop(order) ? { triggerPrice: changes.triggerPrice ?? order.triggerPrice } : {}),
    };
    if (!pricesValid(next, instrument)) return reject("INVALID_PRICE");
    const book = this.book(order.token);
    if (!book) return reject("NO_QUOTE");
    if (this.at - book.at > ctx.staleAfterMs) return reject("STALE_QUOTE");
    if (isStop(next) && !order.triggered && (next.side === "BUY" ? book.lastPrice >= next.triggerPrice! : book.lastPrice <= next.triggerPrice!)) {
      return reject("TRIGGER_ALREADY_CROSSED");
    }
    const remaining = quantity - order.filled;
    if (quantity > order.quantity && instrument.expiry === now.date && now.second >= session.expiryCutoff) {
      const held = this.netUnits(order.token);
      const signed = order.side === "BUY" ? remaining : -remaining;
      const reducing = held !== 0 && Math.sign(signed) !== Math.sign(held) && Math.abs(signed) <= Math.abs(held);
      if (!reducing) return reject("EXPIRY_WINDOW");
    }
    const violation = this.exposureViolation(instrument, order.side === "BUY" ? remaining : -remaining);
    if (violation) return reject(violation);

    const repriced = next.limitPrice !== order.limitPrice || next.triggerPrice !== order.triggerPrice;
    order.lots = lots;
    order.quantity = quantity;
    if (next.limitPrice !== undefined) order.limitPrice = next.limitPrice;
    if (next.triggerPrice !== undefined) order.triggerPrice = next.triggerPrice;
    this.outputs.push({ kind: "modified", at: this.at, orderId: order.id });
    if (!repriced) return;
    order.resting = false;
    this.work(order);
    this.checkLimits(this.at, () => this.fillTrigger());
  }

  private cancel(orderId: string) {
    const order = this.s.orders.find((candidate) => candidate.id === orderId);
    if (!order) {
      this.outputs.push({ kind: "rejected", at: this.at, orderId, reason: "UNKNOWN_ORDER", message: rejectMessage("UNKNOWN_ORDER", this.s.rules) });
      return;
    }
    this.removeOrder(order, "TRADER", this.at);
  }

  private onQuote(quote: Quote) {
    const { s } = this;
    for (const position of s.positions) {
      if (position.instrument.token === quote.token) {
        position.mark = quote.lastPrice;
        position.markAt = quote.at;
      }
    }
    if (s.status === "ACTIVE") {
      for (const order of [...s.orders]) {
        if (order.token === quote.token && s.orders.includes(order)) this.work(order);
      }
    }
    this.checkLimits(this.at, () => ({
      kind: "quote",
      token: quote.token,
      tradingSymbol: this.ctx.instrument(quote.token)?.tradingSymbol ?? String(quote.token),
      lastPrice: quote.lastPrice,
    }));
  }

  private payout(debit: Paise) {
    const { s } = this;
    if (s.phase !== "FUNDED" || s.status !== "ACTIVE" || s.positions.length > 0 || s.orders.length > 0) {
      throw new RangeError("Payouts debit only active, flat funded accounts.");
    }
    const aboveBuffer = s.balance - s.rules.startingBalance - s.rules.maxLoss;
    if (!Number.isSafeInteger(debit) || debit <= 0 || debit > aboveBuffer) {
      throw new RangeError("A payout debit must come from profit above the buffer.");
    }
    s.balance -= debit;
    if (s.day && !s.day.closed) s.day.openingBalance -= debit;
    this.outputs.push({ kind: "payout-debited", at: this.at, debit, balance: s.balance });
  }

  /** Try to fill a working order against the current book. */
  private work(order: WorkingOrder) {
    const { ctx } = this;
    const instrument = ctx.instrument(order.token);
    const book = this.book(order.token);
    if (!instrument || !book || this.at - book.at > ctx.staleAfterMs) return; // no fills on stale prices
    if (isStop(order) && !order.triggered) {
      const reached = order.side === "BUY" ? book.lastPrice >= order.triggerPrice! : book.lastPrice <= order.triggerPrice!;
      if (!reached) return;
      order.triggered = true;
      this.outputs.push({ kind: "triggered", at: this.at, orderId: order.id });
    }
    const market = order.type === "MARKET" || order.type === "SL-M";
    const executions = walkBook(order.side, order.quantity - order.filled, book, {
      limit: market ? null : order.limitPrice!,
      slippage: market ? ctx.slippageTicks * instrument.tickSize : 0,
      tick: instrument.tickSize,
      fillAtLimit: !market && order.resting,
    });
    for (const execution of executions) {
      const violation = this.exposureViolation(instrument, order.side === "BUY" ? execution.quantity : -execution.quantity);
      if (violation) {
        this.removeOrder(order, violation, this.at);
        return;
      }
      this.fill({ instrument, side: order.side, quantity: execution.quantity, price: execution.price, at: this.at, reason: "ORDER", orderId: order.id, ledger: order, book });
      order.filled += execution.quantity;
    }
    if (order.filled >= order.quantity) this.s.orders = this.s.orders.filter((candidate) => candidate !== order);
    else if (!market) order.resting = true;
  }

  private fill(input: {
    instrument: Instrument;
    side: Side;
    quantity: number;
    price: Paise;
    at: number;
    reason: FillReason;
    orderId: string | null;
    ledger: Ledger;
    book: Book | null;
  }) {
    const { s } = this;
    const { instrument } = input;
    const schedule = scheduleFor(s.day?.date ?? toIst(input.at).date, this.ctx.charges);
    const turnover = input.price * input.quantity;
    const charges = chargesForFill({
      kind: instrument.kind,
      exchange: instrument.exchange,
      side: input.side,
      turnover,
      orderTurnoverBefore: input.ledger.turnover,
      brokerageChargedBefore: input.ledger.brokerage,
    }, schedule);
    input.ledger.turnover += turnover;
    input.ledger.brokerage += charges.brokerage;

    let position = s.positions.find((candidate) => candidate.instrument.token === instrument.token);
    if (!position) {
      position = { instrument, open: [], mark: input.book?.lastPrice ?? input.price, markAt: input.book?.at ?? input.at };
      s.positions.push(position);
    } else if (input.book) {
      position.mark = input.book.lastPrice;
      position.markAt = input.book.at;
    }
    const realised = applyFill(position, input.side === "BUY" ? input.quantity : -input.quantity, input.price);
    if (position.open.length === 0) s.positions = s.positions.filter((candidate) => candidate !== position);
    s.balance += realised - charges.total;
    if (s.day) s.day.traded = true;
    s.fillCount += 1;
    const fill: Fill = {
      id: `${s.id}:F${s.fillCount}`,
      orderId: input.orderId,
      reason: input.reason,
      token: instrument.token,
      tradingSymbol: instrument.tradingSymbol,
      side: input.side,
      quantity: input.quantity,
      price: input.price,
      at: input.at,
      realised,
      charges,
      chargesSchedule: schedule.id,
      balanceAfter: s.balance,
    };
    this.outputs.push({ kind: "fill", fill });
    this.lastFill = fill;
  }

  /** Close every open position at market (forced exits fill in full). */
  private flatten(reason: "SQUARE_OFF" | "BREACH", at: number, pricing: "book" | "mark") {
    for (const position of [...this.s.positions]) {
      const net = netQuantity(position);
      if (net === 0) continue;
      const { instrument } = position;
      const side: Side = net > 0 ? "SELL" : "BUY";
      const book = pricing === "book" ? this.sameDayBook(instrument.token) : null;
      const slippage = this.ctx.slippageTicks * instrument.tickSize;
      const ledger: Ledger = { turnover: 0, brokerage: 0 };
      for (const execution of forceExecutions(side, Math.abs(net), book, position.mark, slippage, instrument.tickSize)) {
        this.fill({ instrument, side, quantity: execution.quantity, price: execution.price, at, reason, orderId: null, ledger, book });
      }
    }
  }

  /** Daily loss and max drawdown on balance plus open P&L; breach, lock and flatten (RULE-2, RULE-4). */
  private checkLimits(at: number, trigger: () => BreachTrigger | null) {
    const { s } = this;
    if (s.status !== "ACTIVE" || !s.day) return;
    let unrealised = 0;
    for (const position of s.positions) {
      if (at - position.markAt > this.ctx.staleAfterMs) return; // rules never breach on stale prices
      unrealised += unrealisedPnl(position);
    }
    const equity = s.balance + unrealised;
    const hits = limitBreaches(s.rules, { equity, dayOpeningBalance: s.day.openingBalance, highWaterEod: s.highWaterEod });
    const cause = hits.length > 0 ? trigger() : null;
    if (!cause) return;
    s.status = "FAILED";
    s.breach = {
      rules: hits,
      at,
      date: s.day.date,
      ruleVersion: s.rules.version,
      equity,
      dayOpeningBalance: s.day.openingBalance,
      dailyLossLimit: s.rules.dailyLoss,
      maxLossFloor: maxLossFloor(s.rules, s.highWaterEod),
      trigger: cause,
      positions: positionsView(s),
    };
    this.outputs.push({ kind: "breach", report: s.breach });
    this.cancelAll("BREACH", at);
    this.flatten("BREACH", at, "book");
  }

  private fillTrigger(): BreachTrigger | null {
    const fill = this.lastFill;
    return fill
      ? { kind: "fill", fillId: fill.id, orderId: fill.orderId, tradingSymbol: fill.tradingSymbol, side: fill.side, quantity: fill.quantity, price: fill.price }
      : null;
  }

  private cancelAll(reason: CancelReason, at: number) {
    for (const order of this.s.orders) this.outputs.push({ kind: "cancelled", at, orderId: order.id, reason, filled: order.filled });
    this.s.orders = [];
  }

  private removeOrder(order: WorkingOrder, reason: CancelReason, at: number) {
    this.s.orders = this.s.orders.filter((candidate) => candidate !== order);
    this.outputs.push({ kind: "cancelled", at, orderId: order.id, reason, filled: order.filled });
  }

  private book(token: number): Book | null {
    if (!this.books.has(token)) {
      const quote = this.ctx.quote(token);
      this.books.set(token, quote ? bookFrom(quote) : null);
    }
    return this.books.get(token) ?? null;
  }

  private sameDayBook(token: number): Book | null {
    const book = this.book(token);
    return book && this.s.day && toIst(book.at).date === this.s.day.date ? book : null;
  }

  private netUnits(token: number): number {
    const position = this.s.positions.find((candidate) => candidate.instrument.token === token);
    return position ? netQuantity(position) : 0;
  }

  /** Exits are always allowed; anything that adds lots past the limit or a naked short is not. */
  private exposureViolation(instrument: Instrument, delta: number): "LOT_LIMIT" | "NAKED_SHORT" | null {
    const before = holdingsOf(this.s);
    const after = before.map((holding) => ({ ...holding }));
    const existing = after.find((holding) => holding.instrument.token === instrument.token);
    if (existing) existing.quantity += delta;
    else after.push({ instrument, quantity: delta });
    const was = exposure(before);
    const will = exposure(after);
    if (will.nakedShortLots > was.nakedShortLots) return "NAKED_SHORT";
    if (will.lots > this.s.rules.maxLots && will.lots > was.lots) return "LOT_LIMIT";
    return null;
  }
}
