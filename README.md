# SVAN Capital

SVAN Capital is a professional trader network for GEX analysis, quant briefs, stock deep dives, and proof-backed operator profiles. Traders can import broker or prop-firm history, review code-computed metrics, publish immutable profile versions, and share research or performance context with other market professionals.

It does not manage money, execute trades, copy trades, provide investment advice, or guarantee performance. Public pages must keep the past-performance disclaimer.

## Current Stack

- Next.js 16 App Router
- React 19
- Prisma 7 with generated client in `src/generated/prisma`
- Postgres 16 via Docker Compose
- NextAuth v5 credentials auth
- Tailwind v4
- Recharts
- OpenAI by default, Anthropic via `AI_PROVIDER=anthropic`

## Product Direction

- Trader-only network, not a consumer investing app.
- `/network` is the core surface: GEX rooms, quant labs, deep-dive prompts, and operator cards.
- `/p/[slug]` is a public operator card backed by published `ProfileVersion` snapshots.
- `/reports` now acts as a research brief archive; AI drafts prose only from code-computed metrics.
- GEX and market-structure discussion must remain non-advisory and evidence-led.

## Core Rules

- Code calculates numbers. AI only explains already-computed metrics.
- Public performance reads from published `ProfileVersion` snapshots, not live imports.
- CSV/import hashes are recorded and duplicate source files are rejected per account.
- Privacy redaction affects public display only; metrics are not recalculated.
- Proof Levels currently support CSV imports, broker statements, and tax-return / official-tax-record evidence.

## Commands

```bash
npm run db:up
npm run db:migrate
npm run db:generate
npm run db:seed
npm run dev
npm test
npm run typecheck
npm run lint
```

Demo after seeding: `/p/demo`, login `demo@trustsvan.app` / `demo1234`.

## Important Files

- `CLAUDE.md` - architecture and guardrails
- `MVP2.md` - living operator card plan/status
- `TODO.md` - backlog and caveats
- `prisma/schema.prisma` - data model
- `src/lib/metrics.ts` - code-of-record metrics engine
- `src/lib/trust.ts` - SVAN operator score and risk layer
- `src/lib/ingest/import.ts` - source-agnostic import write path
- `src/lib/published-profile.ts` - public snapshot reconstruction
