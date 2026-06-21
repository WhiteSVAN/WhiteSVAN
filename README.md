# WhiteSVAN — TrustSVAN

TrustSVAN bridges the trust gap between traders and clients, and gives professional traders a network card for peer discovery. Prop-firm traders, independent traders or contractors, brokers, and trading teams import broker or prop-firm history, review code-computed metrics, publish immutable profile versions, and share read-only trust profiles in client or trader-to-trader contexts.

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

## Core Rules

- Code calculates numbers. AI only explains already-computed metrics.
- Public performance reads from published `ProfileVersion` snapshots, not live imports.
- The authenticated `/network` surface is for professional trader-to-trader discovery; member cards link back to proof-backed public profiles.
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

- `CLAUDE.md` — architecture and guardrails
- `MVP2.md` — living trust profile plan/status
- `TODO.md` — backlog and caveats
- `prisma/schema.prisma` — data model
- `src/lib/metrics.ts` — code-of-record metrics engine
- `src/lib/trust.ts` — TrustSVAN score and client-readable risk layer
- `src/lib/ingest/import.ts` — source-agnostic import write path
- `src/lib/published-profile.ts` — public snapshot reconstruction
