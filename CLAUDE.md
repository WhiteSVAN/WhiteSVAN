@AGENTS.md

# WhiteSVAN — SVAN Trust OS

AI-powered client reporting & risk intelligence for serious traders and emerging portfolio managers.
Traders upload broker / prop-firm history (CSV) and get verified performance dashboards, risk
analytics, AI-written client reports, and a private read-only client portal.

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
| AI       | OpenAI              | **Anthropic SDK** (`@anthropic-ai/sdk`) — Claude             |
| Charts   | Recharts            | Recharts ✓                                                   |
| UI       | shadcn/ui           | Tailwind v4 only so far (no component lib added yet)          |
| Hosting  | Vercel              | TBD                                                           |

## Architecture: the one rule

**Code calculates numbers. AI only explains them.** Never let the model compute P&L, returns, or
drawdown. The flow is strictly one-directional:

```
CSV / manual entry  →  parse + map (src/lib/csv)  →  trades  →  daily rollup
   →  metrics engine (src/lib/metrics, pure TS)  →  metrics JSON (code-of-record)
   →  AI layer (src/lib/ai, Claude)  →  written report sections  →  review/publish  →  /p/[slug]
```

- [src/lib/metrics.ts](src/lib/metrics.ts) — pure, dependency-free metrics. Keep it that way so it's
  trivially testable and runs on server or client. This is the source of truth for every number.
- [src/lib/csv/parse.ts](src/lib/csv/parse.ts) — PapaParse + canonical column mapping with broker
  presets (IBKR, manual template), tolerant date/number parsing, per-row error reporting.
- `src/lib/ai/` — *to build.* Feeds the metrics JSON to Claude; the model writes, classifies, warns.
  It must never receive raw trades to "do math" with.

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
`AUTH_SECRET` (`npx auth secret`), `ANTHROPIC_API_KEY`, `AI_MODEL` (defaults to a Haiku model for
cheap v1 report generation). `prisma.config.ts` loads `.env` via `dotenv` and reads `DATABASE_URL`.

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

**Done (uncommitted on `main`):** Prisma schema + generated client, metrics engine + tests, CSV
parse/mapping + tests, Docker Postgres, vitest. Dependencies installed (NextAuth, Anthropic SDK,
recharts, zod, papaparse, bcryptjs, date-fns).

**Not built yet:** auth wiring (`auth.ts` + route handler), the `src/lib/ai` layer, and every app
route beyond the default home page.

Roadmap (PDF §14, milestones M1–M6):
1. **M1 App shell** — auth, protected layout, `/onboarding` trader profile.
2. **M2 CSV import** — `/upload`: file → map columns → preview → `/api/import/{preview,confirm}`;
   rebuild `DailyPnl`. Manual daily-P&L fallback form.
3. **M3 Metrics** — `/dashboard`: metric cards, equity curve, daily-P&L bars, date/account filters,
   `/api/metrics`.
4. **M4 AI reports** — `/reports`: `/api/reports/generate` (Claude), editor, save draft.
5. **M5 Client portal** — `/p/[slug]` read-only, `/api/reports/publish`, `/api/public/[slug]`, PDF
   export (print-to-PDF first), disclaimers.
6. **M6 Launch** — landing page, sanitized demo data, beta.

Planned routes: `/login`, `/onboarding`, `/upload`, `/dashboard`, `/reports`, `/p/[slug]`,
`/settings`. Planned APIs: `/api/profile`, `/api/accounts`, `/api/import/{preview,confirm}`,
`/api/metrics`, `/api/reports/{generate,publish}`, `/api/public/[slug]`.
