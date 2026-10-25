@AGENTS.md

# WhiteSVAN (formerly TrustSVAN)

WhiteSVAN is an India-first **prop trading firm** for NIFTY, BANK NIFTY and SENSEX futures and
options, modelled on MFFU, Tradeify and Topstep. Traders learn with **SVAN Academy**, pay a one-time
fee for a **simulated evaluation**, and those who pass get a **simulated funded account** with an
80% profit split, paid out in rupees. The public site (`/`, `/evaluations`, `/rules`, `/help`,
`/academy`) is the storefront. It is **launching soon**: no payment gateway yet, so checkout runs in
demo mode (below).

The original product, a trader-verification **journal** (imports, metrics, research profiles, AI
briefs, discovery network), and the Zerodha **track record** are **switched off** (25 Oct 2026):
`next.config.ts` redirects their routes (`/journal`, `/upload`, `/reports`, `/explore`, `/p/…`,
`/feed`, `/communities`, `/inbox`, `/track`, …) to My accounts or home, and nothing links to them.
Their code is still in the repo; deleting those redirects brings them back.

> Founder direction (Oct 2026): match the wording and structure of MFFU, Tradeify and Topstep
> (evaluation, funded account, profit split, payouts, max drawdown, "Get funded") in our own
> sentences, with our real numbers, in the existing forest/lime colour grading. The business plan,
> sprint backlog, technical requirements (TRD) and cost model live in Notion ("SVAN India v4").
>
> Founder direction (25 Oct 2026): keep it simple, in threes. Three indices, three account sizes,
> three steps (pass the evaluation, get funded, get paid), three steps to pay (create account,
> choose size, pay), and lists of three where a list is needed. No filler copy or illustrative
> numbers. Never show Zerodha or Kite in anything users read: say "live prices" or "the price
> feed" (code, env vars and `/api/zerodha/*` keep their names).

## Programme boundaries (load-bearing)

- **All evaluation and funded accounts are simulated.** Traders never receive live capital and never
  deposit money; course and evaluation fees are service fees. Payouts are real and follow the profit
  split, per-request caps, the profit buffer and the rules.
- The firm may separately copy selected funded traders with **its own** capital (an optional copy
  desk in an LLP). That never changes a trader's account or pay, and no trader logs in to the firm's
  broker account. Not built.
- **No advice.** No tips, calls, signals or recommendations, and no income or return promises.
- **Never invent proof.** No made-up stats, payout totals, trader counts, ratings, testimonials,
  "most popular" badges or partner logos. Show them only when they are real.
- Public pages carry the footer disclaimers: simulated accounts, not investment advice, F&O risk,
  past performance does not guarantee future results.
- **Code calculates numbers. AI only explains them** (see the journal architecture below).

## Prop-firm site: where things live

- [src/lib/prop-firm.ts](src/lib/prop-firm.ts): the single source of programme numbers and rule text.
  `EVALUATION_PLANS` (the three sizes on sale, ₹1L, ₹5L and ₹10L: fee, lots, payout cap;
  `RECOMMENDED_PLAN` is ₹5L), `PROGRAMME_RULES` (6% target, 4% end-of-day drawdown, 2% daily loss,
  5 days, 50% consistency, 80% split, 3 accounts), `PROGRAMME_STEPS` (pass, get funded, get paid)
  and `RULE_SECTIONS` (anchors such as `#desk`). ₹2.5L is retired: `findEvaluationPlan` (on sale)
  no longer finds it, `findAccountPlan` (labels and rules of existing accounts) still does. Pages,
  the help center and Academy lessons derive figures from here.
- [src/components/prop-firm/](src/components/prop-firm/): `PropHeader` (announcement bar, nav, and an
  optional Discord link when `NEXT_PUBLIC_DISCORD_URL` is set), `PropLanding`, `AccountSelector`
  (Evaluation / Funded toggle) and `HelpCenter` (client-side search).
- Routes: `/`, `/evaluations`, `/evaluations/[plan]` (plan ids `1l`, `5l`, `10l`),
  `/how-it-works`, `/funded` (funded accounts, payout rules and the payout calculator; the signed-in
  `/payouts` is a different page), `/rules`, `/help` (content and search in
  [src/lib/help-center.ts](src/lib/help-center.ts)), `/academy` (lessons in
  [src/lib/academy-content.ts](src/lib/academy-content.ts)). `sitemap.ts`, `robots.ts` and the
  storefront `opengraph-image.tsx` read the public origin from [src/lib/site.ts](src/lib/site.ts).
- **Buying an evaluation: three steps** (founder's rule of three, 25 Oct 2026): create an account,
  choose the size, pay. "Get funded" and "Start your evaluation" go to `/checkout`. Signed out,
  that's sign-up first (`/signup?next=/checkout`), which asks for no size, and sign-up sends
  traders straight on to checkout (or to `?next=`). `/checkout` opens `/checkout/<plan>` on
  `startingPlan` (`RECOMMENDED_PLAN`, ₹5L, or the largest size the demo credit covers); a pricing
  card opens its own size (signed out: `/signup?plan=<id>`). Checkout is one screen: step 2 picks
  the size in place (the address follows; the form posts `plan`), step 3 is mobile, state (filled
  in from the last order), the agreement and Pay; the name comes from the account →
  `/checkout/complete/<order>` → "Start trading" → `/trade/<account>`. `StartSteps` shows the
  steps on sign-up and checkout. Every account is a trader: sign-up has no client option, Google
  sign-ups land on `/onboarding/continue` (trader role, then `next`), and `requireMember` makes
  any role-less user a trader in place. Keep new step lists to three. Traders don't need a journal profile for any of this (`requireMember` in
  [src/lib/auth/dal.ts](src/lib/auth/dal.ts)). No payment gateway is signed (Razorpay or Cashfree).
  Until one is, checkout runs in **demo mode** (founder's decision, 24 Oct 2026, for demos):
  - Every user has ₹50,000 of virtual demo credit (`DEMO_CREDIT` in
    [src/lib/checkout/demo.ts](src/lib/checkout/demo.ts); `User.demoCreditSpent` in paise).
  - Evaluations are bought at the normal prices with it. The order has provider `"demo"`, and the
    credit is spent in the same transaction, conditional on enough being left.
  - The account is marked `EvaluationAccount.demo`, shows a Demo label, and never leads to a funded
    account or a payout.
  - The sign-ins in `STAFF_EMAILS` still make **test purchases** (provider `"test"`, no credit used).
  - `DEMO_CHECKOUT = false` closes checkout to the public again ("opens at launch", with the launch
    list). The storefront copy follows the flag, so it's a code change, not an env var.
  - A gateway adds a live mode in [src/lib/checkout/config.ts](src/lib/checkout/config.ts).
- **Track record** (`/track`, [src/lib/track-record.ts](src/lib/track-record.ts), switched off with
  the journal): the second route in. Traders trade NIFTY, BANK NIFTY and SENSEX F&O in their own Zerodha account, upload Console
  tradebooks, and the programme rules judge each day's closed result (no intraday prices, so limits
  are checked at day end and lot limits aren't checked). `parseZerodhaTradebook` in
  [src/lib/csv/brokers.ts](src/lib/csv/brokers.ts) FIFO-matches fills by execution time, estimates
  F&O charges per order from the dated rate card, and reports open or expired positions without
  pricing them; a pass waits while any remain (`ImportBatch.openPositions`). One track record per
  trader (`TradingAccount.trackPlanId` / `trackStart`); "Start over" moves the start date. WhiteSVAN
  only reads uploads: Kite has no API to set a trader's limits, and acting in their account would
  need exchange empanelment as an algo provider. Not built: live sync (Kite Connect multi-user
  access needs Zerodha's approval), a staff shortlist and the copy engine.
- Accounts: `EvaluationAccount` stores the engine host snapshot (`desk` JSON, written with
  optimistic locking on `version`) and `CheckoutOrder` the purchase
  ([src/lib/accounts/store.ts](src/lib/accounts/store.ts)). At most `maximumAccounts` active.
- The trading platform `/trade/<account>` runs the engine on the server: each poll
  (`/api/accounts/<id>/tick`) gets quotes through the shared Kite login and feeds them to the
  account; orders go to `/api/accounts/<id>/orders`, and modify (PATCH) and cancel (DELETE) to
  `/orders/<orderId>`. `/markets` is the same platform for the trader's active evaluation account
  (`?account=` picks one when they have several): Buy and Sell sit on the chart, and anyone without
  an account gets "Open an evaluation". The blotter shows positions, open orders (modify, cancel),
  the order history (`Desk.orderBook`: complete, cancelled, rejected, with average price and
  reason), fills and activity. F&O only; stocks are a later step. Every account holder trades while
  an owner's Kite login is connected; after Kite's 06:00 IST logout traders see "Live prices are
  offline" until a `KITE_OWNER_EMAILS` sign-in connects again. Orders, stops and the 15:20
  square-off run while a platform page is open (the always-on engine service is still to build).
- Signed-in workspace ([src/app/(app)/layout.tsx](src/app/(app)/layout.tsx)): three tabs, My
  accounts (`/dashboard`, account cards with meters), Charts (`/markets`, once Kite is configured) and
  Payouts (`/payouts`); Academy, Help, Settings (name and email only) and sign-out sit in the account
  menu.
  The launch list ([src/app/waitlist-form.tsx](src/app/waitlist-form.tsx)) writes `WaitlistEntry`.
- **Not built yet:** a payment gateway, GST invoices and refunds, the always-on engine service with a
  licensed market-data feed, KYC, payout processing and the copy engine. The spec is the Notion page
  "Platform Technical Requirements (TRD v1)". Never imply a real payment or a payout has happened.

## Trading core (src/lib/trading)

Pure, deterministic TypeScript for the simulator and rule engine (TRD SIM, RULE, PAY-2). No clock,
randomness or I/O: callers pass every timestamp, quote and order in, so a replay reproduces every
result. The future engine service (Node on AWS with the market-data feed) hosts it.

- `money.ts`: all amounts are integer **paise**; rates are integers over 1e8 (0.05% = 50_000).
- `rules.ts`: `ruleSetFor(plan)` builds the rulebook in paise from `prop-firm.ts`; an account keeps
  the copy it was opened with. Touching a limit counts as hitting it (daily loss on balance plus open
  P&L vs the day's opening balance; max drawdown floor trails the highest end-of-day balance and
  locks at the starting balance). Pass = target + 5 days + best day ≤ 50% of profit, checked at the
  day's close.
- `engine.ts`: `openAccount`, `step(state, event, context)`, `replay`, `riskMeters`. Market, limit,
  SL and SL-M orders fill against five-level depth with slippage; validation covers hours
  (09:15–15:20 IST), lots, freeze quantity, tick size, stale quotes, the expiry-day cutoff and naked
  short options (a short option must be covered by a long one of the same underlying, expiry and
  type). A `modify` event changes a working order's lots, limit or trigger under the same checks,
  never below what has filled; a new price is worked against the book at once, a new size waits for
  the next quote. Square-off at 15:20, day close at 15:30, breach → flatten, lock and breach report.
- `charges.ts` + `charges-schedules.ts`: brokerage, STT, exchange charges, SEBI fee, stamp duty and
  GST from **dated schedules**. Add a new row when a rate changes; never edit one fills have used.
  The shipped row is `verified: false` until a real contract note matches it to the paisa.
- `payouts.ts`: payout quote: 80% of profit above the buffer (= max drawdown), capped per request,
  one request per half-month, KYC / agreement / bank / hold checks. TDS is not computed here.
- Lot, tick and freeze sizes and expiries come from the contract master (`Instrument` rows). Tests
  use fixture values, not exchange values.
- The Academy rule practice ([src/lib/academy-practice.ts](src/lib/academy-practice.ts)) runs these
  same rule functions over daily closes.

## Zerodha charts (the firm's shared Kite login) and market data

`/markets` (signed-in, the **Charts** tab; the UI never names Zerodha) charts NIFTY, BANK NIFTY and SENSEX (index,
futures and options) for every signed-in user, from the firm's Zerodha account through Kite
Connect: candles from 1 minute to 1 day, volume and open-interest panes, live quotes and five-level
depth.

- **Shared with every signed-in user (founder's decision, 24 Oct 2026).** A `KITE_OWNER_EMAILS`
  sign-in logs in to Kite. The day's access token is stored, sealed, in the `KiteConnection` row,
  and every user's charts, quotes and trading platform read through it until Kite's 06:00 IST
  logout. Only owners connect or disconnect it, and Kite itself only lets the app's own Zerodha
  client ID log in. The founder made this call aware that Zerodha's API FAQ says "Displaying or
  redistributing Kite Connect API data on external platforms violates exchange data vending
  policies", and that NSE's data policy (cl. 8.4) bars market data for virtual trading. It rests on
  the platform staying private (sign-ups are still open). The licensed-feed routes are in Notion:
  "Market Data & Trading Platform Plan".
- **Market data only.** The same login can trade the firm's real Zerodha account, so `client.ts`
  makes quote, historical and instrument calls only. Never add order, portfolio or funds calls, and
  never send the token to a browser.
- [src/lib/market-data/candles.ts](src/lib/market-data/candles.ts): source-agnostic candles in paise,
  bucketed from the 09:15 IST open like the exchanges' bars, and `foldTick` for live updates.
  [src/components/markets/price-chart.tsx](src/components/markets/price-chart.tsx) draws any candle
  source with TradingView Lightweight Charts (Apache-2.0; keep its attribution logo), so trader
  screens can reuse it on a licensed feed.
- [src/lib/zerodha/](src/lib/zerodha/): `kite.ts` (request building and parsing to paise, and
  `toEngineQuote` into the trading core's `Quote`), `client.ts` (the calls), `throttle.ts` (one
  login for everyone: a gate keeps to Kite's 1 quote and 3 historical requests a second, screens
  polling together share one quote call, and chart history is reused for 15 s; it works per server
  instance, so a 429 from a second instance makes screens retry), `session.ts` (login checksum; the
  day's access token sealed with AES-256-GCM), `connection.ts` (the shared `KiteConnection` row,
  re-read every 10 s, forgotten when Kite rejects the token), `config.ts` and `access.ts` (owner
  checks, JSON errors, relative redirects).
- Evaluation accounts trade on the same screen (`ZerodhaCharts` with an `account`):
  [src/lib/trading/desk.ts](src/lib/trading/desk.ts) hosts the engine (contracts, quotes, time
  order, fill and activity log) and [src/lib/accounts/ticks.ts](src/lib/accounts/ticks.ts) feeds it
  Kite quotes as books stamped with Kite's quote time, so a stalled feed reads as stale. Fills walk
  Kite's five-level depth with 1 tick of slippage and dated charges. The freeze check stays open
  (Kite's list has no freeze quantity; the plans' 1–8 lot limits bind first) until the contract
  master loads the exchange file.
- Routes: `/api/zerodha/login?next=` → Kite → `/api/zerodha/callback` (register
  `<site>/api/zerodha/callback` as the Kite app's redirect URL), `/api/zerodha/logout` (POST),
  `/api/zerodha/instruments`, `/api/zerodha/candles`, `/api/zerodha/quotes`, `/api/accounts/<id>/…`.
- Env: `KITE_API_KEY`, `KITE_API_SECRET` (a ₹500/month Kite Connect app), `KITE_OWNER_EMAILS`.
  Outside production only, `KITE_API_ROOT` and `KITE_LOGIN_URL` point at a stand-in Kite server and
  `TRADING_CLOCK_OFFSET_MS` shifts the engine's clock, for local tests at any hour.

## Plan vs. reality

The original MVP PDF suggested Supabase + Supabase Auth + OpenAI + shadcn. The codebase chose
differently. Build against what's here:

| Layer    | PDF said            | **Actually used**                                            |
| -------- | ------------------- | ------------------------------------------------------------ |
| Database | Supabase Postgres   | **Postgres 16** (Docker Compose locally)                     |
| ORM      | (raw SQL)           | **Prisma 7** (client generated to `src/generated/prisma`)    |
| Auth     | Supabase Auth       | **NextAuth v5 (Auth.js)**: credentials, Google, adapter models |
| AI       | OpenAI              | **OpenAI (default) + Anthropic/Claude**, switchable via `AI_PROVIDER` |
| Charts   | Recharts            | Recharts ✓                                                   |
| UI       | shadcn/ui           | Tailwind v4 only (no component lib)                          |
| Hosting  | Vercel              | **Vercel**: production is white-svan.vercel.app, from `main` |

## Journal tools: the one rule

(Switched off since 25 Oct 2026; see the top of this file. This applies if they come back.)

**Code calculates numbers. AI only explains them.** Never let the model compute P&L, returns, or
drawdown. The flow is strictly one-directional:

```
Broker / prop-firm source history  →  normalize (src/lib/csv bridge today)  →  trades  →  daily rollup
   →  metrics engine (src/lib/metrics) + trust engine (src/lib/trust)  →  metrics JSON
   →  AI layer (src/lib/ai)  →  written report sections  →  review/publish  →  /p/[slug]
```

- [src/lib/metrics.ts](src/lib/metrics.ts): pure, dependency-free metrics. The source of truth for
  every number; runs on server or client.
- [src/lib/trust.ts](src/lib/trust.ts): research profile layer over metrics: Big-Win Dependency,
  Biggest-Drop severity, Bounce-Back Time, five sub-scores + the weighted Transparency Score, and a
  plain-English verdict. Drives the journal **Client view** (the **Trader view** shows raw metrics).
- [src/lib/csv/parse.ts](src/lib/csv/parse.ts): bridge parser with **alias-based auto-detection** that
  maps IBKR Flex (`FifoPnlRealized`/`IBCommission`/`Buy/Sell`/`TradeDate` YYYYMMDD), IBKR Activity, the
  bridge template, and the **realized gain/loss exports** from Fidelity (`Total Gain/Loss`) and E*TRADE
  (`Gain/Loss`), with no column mapping for known sources. Retail *transaction* exports
  (Robinhood/Webull/Fidelity activity) carry no per-row realized P&L, so the bridge parser flags them
  and they await a FIFO round-trip matcher. Tolerant date/number parsing; fees stored as magnitude.
- [src/lib/ai/](src/lib/ai/): provider-agnostic report generator. One `(ReportInput) => AiReport`
  contract; `AI_PROVIDER` picks **OpenAI** (default) or **Claude**. The strict system prompt + the
  banned-language filter ([compliance.ts](src/lib/ai/compliance.ts)) are the guardrail. It receives
  the computed metrics as text, never raw trades to "do math" with.

`metrics` JSON is persisted verbatim on `Report.metrics` so a published report is reproducible even
if trades change later. AI output lives separately on `Report.aiReport`.

## Data model

Prisma schema: [prisma/schema.prisma](prisma/schema.prisma). Two groups:

- **Auth.js models**: `User`, `Account`, `Session`, `VerificationToken`. ⚠️ `Account` is the
  OAuth/credentials provider link. A user's *brokerage* account is **`TradingAccount`**; don't
  confuse them. Credentials sign-in uses `User.passwordHash` (bcryptjs).
- **Domain**: `TraderProfile` (profile identity, unique `slug` -> `/p/[slug]`, private by default),
  `TradingAccount`, `Trade` (raw source rows kept in `raw` Json), `DailyPnl`
  (per-account/day rollup, rebuilt from loaded trades, `@@unique([accountId, tradeDate])`),
  `Report` (`metrics` + `aiReport` JSON, `DRAFT`/`PUBLISHED`), `WaitlistEntry` (launch list).
  `EvaluationAccount` (the engine snapshot in `desk`, `version` for optimistic locking, `demo` for
  accounts bought with demo credit) and `CheckoutOrder` (amount in paise, provider `test`, `demo`
  or a gateway, billing, GST place of supply). `User.demoCreditSpent` tracks demo credit. There are no payout
  tables yet (see the TRD's data model).

Money is `Decimal(18,2)`; prices `Decimal(18,6)`; quantity `Decimal(18,4)`. Dates that are
calendar-only use `@db.Date`. All domain rows cascade-delete from their owner.

## Commands

```bash
npm run db:up         # start Postgres (docker compose up -d)
npm run db:migrate    # prisma migrate dev   (apply/create migrations)
npm run db:generate   # regenerate Prisma client into src/generated/prisma
npm run db:studio     # Prisma Studio
npm run dev           # Next.js dev server
npm test              # vitest run        (tests are src/**/*.test.ts, colocated)
npm run test:watch
npm run typecheck     # tsc --noEmit
npm run lint
```

**Env:** `cp .env.example .env` and fill in. Vars: `DATABASE_URL` (Docker default in the example),
`AUTH_SECRET` (`npx auth secret`), optional Google sign-in, AI provider config (`AI_PROVIDER`,
`OPENAI_*`, `ANTHROPIC_*`), optional `NEXT_PUBLIC_DISCORD_URL` and `NEXT_PUBLIC_SITE_URL` (read
at build time; the site URL defaults to https://white-svan.vercel.app), optional Zerodha charts
(`KITE_API_KEY`, `KITE_API_SECRET`, `KITE_OWNER_EMAILS`; see above), `STAFF_EMAILS` (test purchases
at checkout), and `RESEND_API_KEY` + `EMAIL_FROM` (real emails; otherwise they're logged).
Migrations use `DATABASE_URL_UNPOOLED` when set (Neon's direct URL), so a pooler can't hold the
migration lock across deploys.
`prisma.config.ts` loads `.env` via `dotenv`.

**Deploys:** Vercel builds production from `main` (white-svan.vercel.app); branch pushes get preview
URLs behind Vercel login. `npm run build` runs `prisma migrate deploy`, so to check a build locally
run `npx prisma generate && npx next build` instead. On 16 Oct 2026 a branch push was opened as a PR
and merged into `main` within seconds by an integration outside this repo, so treat any push as a
production deploy.

## Conventions

- **TypeScript everywhere**, strict. Code in `src/`. App Router pages/handlers under `src/app/`.
- **Naming:** canonical fields and TS use `camelCase` (`tradeDate`, `realizedPnl`); bridge source
  templates and SQL use `snake_case` (`trade_date`). The parser layer maps between them; see
  `CANONICAL_FIELDS`.
- **Tests colocate** next to source as `*.test.ts` (e.g. `metrics.test.ts`). Pure logic gets unit
  tests; cover the metric math, programme figures and source-file edge cases (currency symbols,
  `(parenthesized)` negatives, US vs ISO dates).
- **Prisma client** is imported from `src/generated/prisma` (custom output), *not* `@prisma/client`.
  After any schema change: `npm run db:migrate` then `npm run db:generate`. Don't hand-edit generated
  files.
- **Next.js 16 is not your trained Next.js**: per [AGENTS.md](AGENTS.md), read
  `node_modules/next/dist/docs/` before writing routes, handlers, or config.
- **Programme figures come from `src/lib/prop-firm.ts`.** Don't hard-code a fee, limit or split in a
  page; don't hard-code exchange lot sizes, tax rates or expiry days (they change; use a dated
  contract master when the simulator exists).

## Journal guardrails

The journal reports on *past* performance only and must never tell anyone what to trade, how much
to allocate, or whether to invest. The AI report generator runs with a strict system prompt and
returns JSON matching a fixed schema (`executive_summary`, `performance_summary`, `risk_summary`,
`discipline_review`, `notable_days`, `warnings`, `client_disclaimer`).

A **banned-language filter** must reject drafts containing: *guaranteed returns, risk-free, safe
investment, you should invest, allocate X percent, copy my trade, will make money, assured profits.*
The same phrases must never appear in prop-firm copy. Every public card and brief carries a "past
performance does not guarantee future results" disclaimer.

Out of scope: signals, personalized advice, managing client money (AUM), custody, and copying trades
for clients. The firm's own copy desk is a separate, unbuilt system (see Programme boundaries).

Community/chat guardrail: verified rooms can discuss methods, assumptions, source data, risks,
counterviews, and post-mortems. They must not become paid signal rooms, copy-trading groups, or
personalized allocation channels. Discord integration should use OAuth/linked roles so proof-level
metadata gates access without exposing private evidence files.

## Build status & roadmap

- ✅ **Prop-firm storefront (Oct 2026)**: landing in the MFFU/Tradeify/Topstep pattern, pricing with
  an Evaluation / Funded toggle, plan pages, rules, searchable help center, Academy (free lessons and
  rule practice), launch list, plan-aware trader sign-up, prop-only workspace (journal switched off
  25 Oct 2026). Handoff notes: [docs/prop-firm-repurpose-review.md](docs/prop-firm-repurpose-review.md).
- ✅ **Trading core (Oct 2026)**: `src/lib/trading` (paise money, charges from dated schedules,
  order matching, positions, rule engine, risk meters, payout quote, deterministic replay), with the
  Academy rule practice running on it. Covers the pure-logic parts of stories S3-01, S3-02, S4-06,
  S5-02 and PAY-2; still open there: a contract-note match for the charges, the contract-master
  service and data feed, and hosting the engine live.
- ✅ **Zerodha charts (Oct 2026)**: `/markets` on the firm's Kite Connect login (index, futures
  and options; candles, volume, OI, live quotes, depth) with a source-agnostic chart component.
  Shared with every signed-in user since 24 Oct 2026.
- ✅ **Checkout, accounts and the trading platform (Oct 2026)**: three-step buying (account, size,
  pay) to `/trade/<account>`, demo evaluations on ₹50,000 of virtual credit (staff: test purchases) until a gateway is signed, stored evaluation
  accounts on the server-side engine, My accounts cards. Every account holder trades on the shared
  Kite login.
- **Next (see the Notion TRD and sprint stories):** contract master (S1-10, S2-06), the engine
  service with Redis and a replay provider, checkout (UPI/cards via an Indian gateway), evaluation
  provisioning with live risk meters, KYC, payouts with TDS, then the optional copy desk.
- ⏸ **Journal (formerly TrustSVAN), M1–M6 and trust features** (switched off 25 Oct 2026): NextAuth app shell; `/upload` source
  history bridge with `DailyPnl` rebuild; metrics dashboard (now `/journal`) with Research ⇄ Trader
  views; AI reports with live compliance; public `/p/[slug]` profiles with evidence locker and Proof
  Levels via [src/lib/proof.ts](src/lib/proof.ts); `/explore` directory; Transparency Score breakdown
  and calendar heatmap. Evidence files live under `storage/` (git-ignored). Seeded demo at `/p/demo`
  (`npm run db:seed`).
- **Journal deferred:** direct read-only broker connectors, a FIFO round-trip matcher for retail
  transaction exports, Proof Level 5 (third-party verification), IBKR Flex auto-pull, multi-account
  research profiles.
