@AGENTS.md

# WhiteSVAN (formerly TrustSVAN)

WhiteSVAN is an India-first **prop trading firm** for NIFTY, BANK NIFTY and SENSEX futures and
options, modelled on MFFU, Tradeify and Topstep. Traders learn with **SVAN Academy**, pay a one-time
fee for a **simulated evaluation**, and those who pass get a **simulated funded account** with an
80% profit split, paid out in rupees. The public site (`/`, `/evaluations`, `/rules`, `/help`,
`/academy`) is the storefront. It is **launching soon**: there is no checkout yet.

The original product, a trader-verification **journal** (imports, metrics, research profiles, AI
briefs, discovery network), still ships as secondary tools under the signed-in **Tools** menu
(`/journal`, `/upload`, `/reports`, `/explore`, `/feed`, `/communities`, `/inbox`).

> Founder direction (Oct 2026): match the wording and structure of MFFU, Tradeify and Topstep
> (evaluation, funded account, profit split, payouts, max drawdown, "Get funded") in our own
> sentences, with our real numbers, in the existing forest/lime colour grading. The business plan,
> sprint backlog, technical requirements (TRD) and cost model live in Notion ("SVAN India v4").

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
  `EVALUATION_PLANS` (₹1L–₹10L: fee, lots, payout cap), `PROGRAMME_RULES` (6% target, 4% end-of-day
  drawdown, 2% daily loss, 5 days, 50% consistency, 80% split, 3 accounts) and `RULE_SECTIONS`
  (anchors such as `#desk`). Pages, the help center and Academy lessons derive figures from here.
- [src/components/prop-firm/](src/components/prop-firm/): `PropHeader` (announcement bar, nav, and an
  optional Discord link when `NEXT_PUBLIC_DISCORD_URL` is set), `PropLanding`, `AccountSelector`
  (Evaluation / Funded toggle) and `HelpCenter` (client-side search).
- Routes: `/`, `/evaluations`, `/evaluations/[plan]` (plan ids `1l`, `2-5l`, `5l`, `10l`), `/rules`,
  `/help` (content and search in [src/lib/help-center.ts](src/lib/help-center.ts)), `/academy`
  (lessons in [src/lib/academy-content.ts](src/lib/academy-content.ts)).
- Purchase calls to action go to `/signup?plan=<id>`, which shows the chosen plan. Sign-up defaults to
  the trader role; `?as=client` is the firm/allocator path. The launch list
  ([src/app/waitlist-form.tsx](src/app/waitlist-form.tsx)) writes `WaitlistEntry`.
- Signed-in workspace ([src/app/(app)/layout.tsx](src/app/(app)/layout.tsx)): My accounts
  (`/dashboard`), Evaluations, Payouts (`/payouts`), Academy and Help, with the journal tools under
  **Tools** ([src/components/workspace-nav.tsx](src/components/workspace-nav.tsx)).
- **Not built yet:** checkout and payments, evaluation provisioning, the engine service with market
  data, KYC, payout processing and the copy engine. The spec is the Notion page "Platform Technical
  Requirements (TRD v1)". Until those exist, never imply that a purchase, account activation or
  payout has happened.

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
  type). Square-off at 15:20, day close at 15:30, breach → flatten, lock and breach report.
- `charges.ts` + `charges-schedules.ts`: brokerage, STT, exchange charges, SEBI fee, stamp duty and
  GST from **dated schedules**. Add a new row when a rate changes; never edit one fills have used.
  The shipped row is `verified: false` until a real contract note matches it to the paisa.
- `payouts.ts`: payout quote: 80% of profit above the buffer (= max drawdown), capped per request,
  one request per half-month, KYC / agreement / bank / hold checks. TDS is not computed here.
- Lot, tick and freeze sizes and expiries come from the contract master (`Instrument` rows). Tests
  use fixture values, not exchange values.
- The Academy rule practice ([src/lib/academy-practice.ts](src/lib/academy-practice.ts)) runs these
  same rule functions over daily closes.

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
  There are no evaluation, funded-account or payout tables yet (see the TRD's data model).

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
`OPENAI_*`, `ANTHROPIC_*`), and optional `NEXT_PUBLIC_DISCORD_URL` (read at build time).
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
  rule practice), launch list, plan-aware trader sign-up, prop-first workspace with the journal under
  Tools. Handoff notes: [docs/prop-firm-repurpose-review.md](docs/prop-firm-repurpose-review.md).
- ✅ **Trading core (Oct 2026)**: `src/lib/trading` (paise money, charges from dated schedules,
  order matching, positions, rule engine, risk meters, payout quote, deterministic replay), with the
  Academy rule practice running on it. Covers the pure-logic parts of stories S3-01, S3-02, S4-06,
  S5-02 and PAY-2; still open there: a contract-note match for the charges, the contract-master
  service and data feed, and hosting the engine live.
- **Next (see the Notion TRD and sprint stories):** contract master (S1-10, S2-06), the engine
  service with Redis and a replay provider, checkout (UPI/cards via an Indian gateway), evaluation
  provisioning with live risk meters, KYC, payouts with TDS, then the optional copy desk.
- ✅ **Journal (formerly TrustSVAN), M1–M6 and trust features**: NextAuth app shell; `/upload` source
  history bridge with `DailyPnl` rebuild; metrics dashboard (now `/journal`) with Research ⇄ Trader
  views; AI reports with live compliance; public `/p/[slug]` profiles with evidence locker and Proof
  Levels via [src/lib/proof.ts](src/lib/proof.ts); `/explore` directory; Transparency Score breakdown
  and calendar heatmap. Evidence files live under `storage/` (git-ignored). Seeded demo at `/p/demo`
  (`npm run db:seed`).
- **Journal deferred:** direct read-only broker connectors, a FIFO round-trip matcher for retail
  transaction exports, Proof Level 5 (third-party verification), IBKR Flex auto-pull, multi-account
  research profiles.
