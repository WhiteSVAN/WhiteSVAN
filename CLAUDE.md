@AGENTS.md

# WhiteSVAN — TrustSVAN

AI-powered trust infrastructure for trader-client relationships. Prop-firm traders, independent
traders or contractors, brokers, and trading teams upload broker / prop-firm history (CSV) and get
verified performance dashboards, risk analytics, AI-written client reports, and a private read-only
trust profile clients can understand.

**It is a pure SaaS reporting tool.** It does **not** manage money, execute or copy trades, send
signals, give allocation advice, predict returns, or take performance fees. Those boundaries are not
optional — they shape the data model, the AI layer, and the copy. See [Guardrails](#guardrails).

> The `SVAN_Trader_Trust_AI_MVP_Plan.pdf` is the product brief. Where this file and the PDF disagree
> on *tech*, **this file and the code win** — the implementation deliberately diverged (see below).

## Plan vs. reality

The PDF suggested Supabase + Supabase Auth + OpenAI + shadcn. The codebase chose differently. Build
against what's here:

| Layer    | PDF said            | **Actually used**                                            |
| -------- | ------------------- | ------------------------------------------------------------ |
| Database | Supabase Postgres   | Local **Postgres 16** via Docker Compose                     |
| ORM      | (raw SQL)           | **Prisma 7** (client generated to `src/generated/prisma`)    |
| Auth     | Supabase Auth       | **NextAuth v5 (Auth.js)** — credentials + adapter models     |
| AI       | OpenAI              | **OpenAI (default) + Anthropic/Claude**, switchable via `AI_PROVIDER` |
| Charts   | Recharts            | Recharts ✓                                                   |
| UI       | shadcn/ui           | Tailwind v4 only so far (no component lib added yet)          |
| Hosting  | Vercel              | TBD                                                           |

## Architecture: the one rule

**Code calculates numbers. AI only explains them.** Never let the model compute P&L, returns, or
drawdown. The flow is strictly one-directional:

```
CSV / manual entry  →  parse + auto-map (src/lib/csv)  →  trades  →  daily rollup
   →  metrics engine (src/lib/metrics) + trust engine (src/lib/trust)  →  metrics JSON
   →  AI layer (src/lib/ai)  →  written report sections  →  review/publish  →  /p/[slug]
```

- [src/lib/metrics.ts](src/lib/metrics.ts) — pure, dependency-free metrics. The source of truth for
  every number; runs on server or client.
- [src/lib/trust.ts](src/lib/trust.ts) — TrustSVAN client layer over metrics: Big-Win Dependency,
  Biggest-Drop severity, Bounce-Back Time, five sub-scores + the weighted Transparency Score, and a
  plain-English verdict. Drives the dashboard **Client view** (the **Trader view** shows raw metrics).
- [src/lib/csv/parse.ts](src/lib/csv/parse.ts) — PapaParse + **alias-based auto-detection** that maps
  IBKR Flex (`FifoPnlRealized`/`IBCommission`/`Buy/Sell`/`TradeDate` YYYYMMDD), IBKR Activity, the
  manual template, and the **realized gain/loss exports** from Fidelity (`Total Gain/Loss`) and E*TRADE
  (`Gain/Loss`) — no manual mapping. Retail *transaction* exports (Robinhood/Webull/Fidelity activity)
  carry no per-row realized P&L, so the importer flags them and they await a FIFO round-trip matcher.
  Tolerant date/number parsing; fees stored as magnitude.
- [src/lib/ai/](src/lib/ai/) — provider-agnostic report generator. One `(ReportInput) => AiReport`
  contract; `AI_PROVIDER` picks **OpenAI** (default) or **Claude**. The strict system prompt + the
  banned-language filter ([compliance.ts](src/lib/ai/compliance.ts)) are the guardrail. It receives
  the computed metrics as text — never raw trades to "do math" with.

`metrics` JSON is persisted verbatim on `Report.metrics` so a published report is reproducible even
if trades change later. AI output lives separately on `Report.aiReport`.

## Data model

Prisma schema: [prisma/schema.prisma](prisma/schema.prisma). Two groups:

- **Auth.js models** — `User`, `Account`, `Session`, `VerificationToken`. ⚠️ `Account` is the
  OAuth/credentials provider link. A user's *brokerage* account is **`TradingAccount`** — don't
  confuse them. Credentials sign-in uses `User.passwordHash` (bcryptjs).
- **Domain** — `TraderProfile` (public portal identity, unique `slug` → `/p/[slug]`),
  `TradingAccount`, `Trade` (raw imported rows, original CSV kept in `raw` Json), `DailyPnl`
  (per-account/day rollup, rebuilt from trades on import, `@@unique([accountId, tradeDate])`),
  `Report` (`metrics` + `aiReport` JSON, `DRAFT`/`PUBLISHED`).

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
`AUTH_SECRET` (`npx auth secret`), and AI provider config — `AI_PROVIDER` (`openai` default or
`anthropic`), `OPENAI_API_KEY`/`OPENAI_MODEL`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`. Report
generation needs a key for whichever provider is active. `prisma.config.ts` loads `.env` via `dotenv`.

## Conventions

- **TypeScript everywhere**, strict. Code in `src/`. App Router pages/handlers under `src/app/`.
- **Naming:** canonical fields and TS use `camelCase` (`tradeDate`, `realizedPnl`); CSV templates and
  SQL use `snake_case` (`trade_date`). The CSV layer maps between them — see `CANONICAL_FIELDS`.
- **Tests colocate** next to source as `*.test.ts` (e.g. `metrics.test.ts`). Pure logic gets unit
  tests; cover the metric math and CSV edge cases (currency symbols, `(parenthesized)` negatives,
  US vs ISO dates).
- **Prisma client** is imported from `src/generated/prisma` (custom output), *not* `@prisma/client`.
  After any schema change: `npm run db:migrate` then `npm run db:generate`. Don't hand-edit generated
  files.
- **Next.js 16 is not your trained Next.js** — per [AGENTS.md](AGENTS.md), read
  `node_modules/next/dist/docs/` before writing routes, handlers, or config.

## Guardrails (load-bearing, not legal boilerplate)

The product reports on *past* performance only. In v1 it must never tell anyone what to trade, how
much to allocate, or whether to invest. The AI report generator runs with a strict system prompt and
returns JSON matching a fixed schema (`executive_summary`, `performance_summary`, `risk_summary`,
`discipline_review`, `notable_days`, `warnings`, `client_disclaimer`).

A **banned-language filter** must reject drafts containing: *guaranteed returns, risk-free, safe
investment, you should invest, allocate X percent, copy my trade, will make money, assured profits.*
Every portal/report carries a "past performance does not guarantee future results" disclaimer.

Out of scope for v1: broker OAuth/APIs, auto-execution/copy trading, signals, personalized advice,
AUM/performance fees, custody, full RIA/CTA compliance workflow.

## Build status & roadmap

On branch `feat/foundation-and-auth`.

- ✅ **M1 App shell** — NextAuth (Credentials + JWT), DAL, `/login` `/signup` `/onboarding`, protected layout.
- ✅ **M2 CSV import** — `/upload`: account → file → auto-mapped preview → import → `DailyPnl` rebuild.
- ✅ **M3 Metrics + dashboard** — equity-curve & daily-P&L charts, account/range filters, risk panel.
- ✅ **TrustSVAN dashboard** — plain-English **Client view** (trust metrics, severity, verdict, Transparency
  Score, Proof Level) ⇄ technical **Trader view**, via `?view`. Editable starting balance.
- ✅ **M4 AI reports** — `/reports`: generate (OpenAI default / Claude) → editor with live compliance →
  publish (blocked on banned phrases) / delete.
- ✅ **M5 Client portal** — public `/p/[slug]` (Client view + published reports + disclaimer), public/private
  toggle + share link in the dashboard, Print / Save-PDF.
- ✅ **M6 Launch** — polished landing (hero + waitlist), `WaitlistEntry` capture, seeded demo at `/p/demo`
  (`npm run db:seed`). **MVP complete (M1–M6).**
- ✅ **Trust features** — evidence locker + dynamic **Proof Levels** (CSV data = L2, uploaded broker
  statement = L3, uploaded tax return / official tax record = L4) via [src/lib/proof.ts](src/lib/proof.ts); `/settings` (visibility, $-redaction via
  `hideAmounts`, disclaimer, evidence upload/serve at `/api/evidence/[id]`); public trader directory
  `/explore`. Files stored under `storage/` (git-ignored).

- ✅ **Transparency Score breakdown** (weighted sub-scores in the UI) + **monthly calendar heatmap**.

**Deferred / next:** more broker CSV formats (Fidelity, Webull, Robinhood, E*TRADE — note most retail
	transaction exports lack per-row realized P&L, so they need a FIFO round-trip matcher), Proof Level 5
	(third-party verification), IBKR Flex Web Service auto-pull, multi-account portal,
hosting/deploy.

Planned routes: `/login`, `/onboarding`, `/upload`, `/dashboard`, `/reports`, `/p/[slug]`,
`/settings`. Planned APIs: `/api/profile`, `/api/accounts`, `/api/import/{preview,confirm}`,
`/api/metrics`, `/api/reports/{generate,publish}`, `/api/public/[slug]`.
