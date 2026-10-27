import { describe, expect, it } from "vitest";
import { findEvaluationPlan } from "@/lib/prop-firm";
import { openDesk } from "@/lib/trading/desk";
import type { AccountState } from "@/lib/trading/engine";
import { ist } from "@/lib/trading/time";
import { assembleBook, balanceHistory, pooledDays, type AccountRow, type BookFill } from "./book";
import { csvRupees, csvText } from "./csv";
import { moneyReceived, orderStateLabel } from "./customers";
import { customerFilters, eventFilters, fillFilters, filterQuery, istRange, orderFilters } from "./filters";
import { duration, percent, ratio, signedRupees } from "./format";

const r = (rupees: number) => Math.round(rupees * 100);
const plan = findEvaluationPlan("1l")!;

/** An account row on a fresh ₹1L desk, with closed days and whatever else the test sets. */
function row(id: string, userId: string, fields: Partial<AccountRow> = {}, state: Partial<AccountState> = {}): AccountRow {
  const desk = openDesk(plan, id, ist("2026-11-02 09:00"), fields.phase ?? "EVALUATION");
  return { id, userId, planId: plan.id, phase: "EVALUATION", status: "ACTIVE", fromAccountId: null, createdAt: new Date(ist("2026-11-02 09:00")), ...fields, state: { ...desk.state, ...state } };
}

const fill = (accountId: string, n: number, side: "BUY" | "SELL", at: string, realised = 0, charges = r(20)): BookFill =>
  ({ accountId, id: `${accountId}:F${n}`, token: 1, tradingSymbol: "NIFTY-CE", side, quantity: 75, realised, charges, at: ist(at) });

describe("the admin book", () => {
  it("figures each account and pools each trader's accounts", () => {
    const days = [{ date: "2026-11-02", net: r(1_000) }, { date: "2026-11-03", net: r(-500) }, { date: "2026-11-04", net: r(2_000) }];
    const { traders, accounts } = assembleBook({
      traders: [{ id: "t1", email: "one@example.test", name: "One", createdAt: new Date(0) }],
      accounts: [
        row("a1", "t1", {}, { days, balance: r(1_02_500), highWaterEod: r(1_02_500) }),
        row("a2", "t1", { phase: "FUNDED", fromAccountId: "a3" }, {}),
        row("a3", "t1", { status: "PASSED" }, { status: "PASSED" }),
        row("a4", "t1", { status: "PASSED" }, { status: "PASSED" }),
      ],
      fills: [fill("a1", 1, "BUY", "2026-11-02 10:00"), fill("a1", 2, "SELL", "2026-11-02 11:00", r(1_040))],
      counts: new Map([["t1", { refusals: 2, breaches: 0 }]]),
    });
    const a1 = accounts.find((account) => account.id === "a1")!;
    expect(a1.daily).toMatchObject({ days: 3, netPnl: r(2_500), winningDays: 2 });
    expect(a1.daily.sharpe).not.toBeNull();
    expect(a1.trades).toMatchObject({ trades: 1, wins: 1, expectancy: r(1_000), charges: r(40) });
    expect(a1.lastFillAt).toBe(ist("2026-11-02 11:00"));
    // a3's pass opened a2; a4's pass is waiting for a funded place.
    expect(accounts.filter((account) => account.waiting).map((account) => account.id)).toEqual(["a4"]);
    const trader = traders[0];
    expect(trader.counts).toEqual({ active: 1, funded: 1, passed: 2, failed: 0 });
    expect(trader).toMatchObject({ netPnl: r(2_500), refusals: 2, breaches: 0, lastActivity: ist("2026-11-02 11:00") });
    expect(trader.trades.trades).toBe(1);
  });

  it("flags an active account within a quarter of a limit, and not a closed one", () => {
    const day = { date: "2026-11-02", openingBalance: r(1_00_000), traded: true, squaredOff: false, closed: false, orderIds: [] };
    const { accounts } = assembleBook({
      traders: [],
      accounts: [
        row("near", "t", {}, { balance: r(98_400), day }),
        row("calm", "t", {}, { balance: r(99_000), day }),
        row("over", "t", { status: "FAILED" }, { status: "FAILED", balance: r(98_000), day }),
      ],
      fills: [],
      counts: new Map(),
    });
    const by = Object.fromEntries(accounts.map((account) => [account.id, account]));
    // ₹1,600 of the ₹2,000 daily limit used is 80%: near. ₹1,000 is 50%: calm.
    expect(by.near).toMatchObject({ nearLimit: true, dailyLossShare: 0.8 });
    expect(by.calm).toMatchObject({ nearLimit: false, dailyLossShare: 0.5 });
    expect(by.over.nearLimit).toBe(false);
  });

  it("rebuilds the balance and the trailing floor after each day, and sums days across accounts", () => {
    const account = row("a", "t", {}, { days: [{ date: "2026-11-02", net: r(3_000) }, { date: "2026-11-03", net: r(-1_000) }] });
    // The floor trails the highest close (₹1,03,000 − ₹4,000) but never above the starting balance.
    expect(balanceHistory(account.state).map(({ closing, floor }) => ({ closing, floor }))).toEqual([
      { closing: r(1_03_000), floor: r(99_000) },
      { closing: r(1_02_000), floor: r(99_000) },
    ]);
    expect(pooledDays([account, row("b", "t", {}, { days: [{ date: "2026-11-03", net: r(500) }] })])).toEqual([
      { date: "2026-11-02", net: r(3_000) },
      { date: "2026-11-03", net: r(-500) },
    ]);
  });
});

describe("admin filters", () => {
  it("keeps well-formed filters and drops the rest", () => {
    expect(fillFilters({ from: "2026-11-02", to: "nope", q: " trader ", side: "SELL", reason: "HACK", symbol: "nifty;drop", page: "3" })).toEqual({ from: "2026-11-02", to: undefined, q: "trader", account: undefined, page: 3, symbol: undefined, side: "SELL", reason: undefined });
    expect(eventFilters({ kind: "BREACH", page: "-1", account: "ev1x2y" })).toMatchObject({ kind: "BREACH", page: 1, account: "ev1x2y" });
    expect(eventFilters({ kind: "DROP TABLE", account: "a'; --" })).toMatchObject({ kind: undefined, account: undefined });
  });

  it("turns IST dates into the UTC instants they cover", () => {
    expect(istRange("2026-11-02", "2026-11-02")).toEqual({ gte: new Date("2026-11-01T18:30:00Z"), lt: new Date("2026-11-02T18:30:00Z") });
    expect(istRange(undefined, undefined)).toEqual({});
  });

  it("writes filters back as a query, leaving out page 1 and empty values", () => {
    expect(filterQuery({ from: "2026-11-02", q: undefined, side: "BUY", page: 1 })).toBe("?from=2026-11-02&side=BUY");
    expect(filterQuery({ kind: "PASSED", page: 1 }, 2)).toBe("?kind=PASSED&page=2");
  });
});

describe("billing words", () => {
  it("counts money received only for a captured live Razorpay payment", () => {
    expect(moneyReceived({ provider: "razorpay", status: "PAID" })).toBe(true);
    for (const order of [{ provider: "razorpay", status: "REFUNDED" }, { provider: "razorpay", status: "PENDING" }, { provider: "razorpay-test", status: "PAID" }, { provider: "test", status: "PAID" }, { provider: "free", status: "PAID" }, { provider: "demo", status: "PAID" }] as const) {
      expect(moneyReceived(order)).toBe(false);
    }
  });

  it("never calls an order paid unless money moved", () => {
    expect(orderStateLabel("razorpay", "PAID")).toBe("Paid");
    expect(orderStateLabel("razorpay-test", "PAID")).toBe("Paid in test mode, no money");
    expect(["free", "test", "demo"].map((provider) => orderStateLabel(provider, "PAID"))).toEqual(["Opened, no charge", "Opened, no charge", "Opened, no charge"]);
    expect([orderStateLabel("razorpay", "PENDING"), orderStateLabel("razorpay", "FAILED"), orderStateLabel("razorpay", "REFUNDED")]).toEqual(["Awaiting payment", "Failed", "Refunded"]);
  });

  it("reads customer and order filters, dropping anything malformed", () => {
    expect(customerFilters({ show: "paying", q: "asha" })).toMatchObject({ show: "paying", q: "asha" });
    expect(customerFilters({ show: "everyone" }).show).toBeUndefined();
    const states = ["Karnataka", "Telangana"];
    expect(orderFilters({ provider: "razorpay", status: "PAID", state: "Karnataka" }, states)).toMatchObject({ provider: "razorpay", status: "PAID", state: "Karnataka" });
    expect(orderFilters({ provider: "stripe", status: "SETTLED", state: "Atlantis" }, states)).toMatchObject({ provider: undefined, status: undefined, state: undefined });
  });
});

describe("admin formatting and CSV", () => {
  it("writes missing figures as a dash, never as zero", () => {
    expect([ratio(null), percent(undefined), signedRupees(null), duration(null)]).toEqual(["—", "—", "—", "—"]);
    expect([ratio(1.2345), percent(0.1234), signedRupees(r(-300)), signedRupees(r(1_200)), duration(4_000), duration(125 * 60_000), duration(26 * 3_600_000)]).toEqual(["1.23", "12.3%", "−₹300", "+₹1,200", "4s", "2h 05m", "1d 2h"]);
  });

  it("quotes text cells and keeps a trader's name from running as a spreadsheet formula", () => {
    expect(csvText('Ann "A" Lee')).toBe('"Ann ""A"" Lee"');
    expect(csvText("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvText("+91 98765")).toBe('"\'+91 98765"');
    expect(csvText(null)).toBe('""');
    expect([csvRupees(123_450), csvRupees(-1_200)]).toEqual(["1234.50", "-12.00"]);
  });
});
