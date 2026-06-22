# TrustSVAN

TrustSVAN combines trader verification with a diligence workspace and verified discussion network
for clients, firms, allocators, and collaborators. Traders connect broker or prop-firm history,
publish proof-backed profiles, keep verified metrics current, and join proof-gated strategy rooms;
reviewers screen profiles, inspect evidence, monitor changes, and turn code-computed metrics or
discussion threads into research or diligence updates.

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

- Verification-first product, not a consumer investing app.
- `/network` is the authenticated verified-trader board: screen profiles by style, proof level, and track-record context.
- Verified rooms are the planned Discord/private-chat layer: proof-gated channels for GEX, systematic research, portfolio construction, and private-market diligence.
- `/p/[slug]` is a public research profile backed by published `ProfileVersion` snapshots.
- `/reports` acts as a diligence/research brief archive; AI drafts prose only from code-computed metrics.
- All profile, GEX, market-structure, private-equity, and chat discussion must remain non-advisory and evidence-led.

## Core Rules

- Code calculates numbers. AI only explains already-computed metrics.
- Public performance reads from published `ProfileVersion` snapshots, not live source loads.
- Source-history hashes are recorded and duplicate source files are rejected per account.
- Privacy redaction affects public display only; metrics are not recalculated.
- Proof Levels currently support source-linked history, broker statements, and tax-return / official-tax-record evidence.
- Discord/community access should eventually use OAuth/linked roles so TrustSVAN can expose proof-level metadata without manually granting chat permissions.

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

Demo after seeding: `/p/demo`, login `demo@trustsvan.local` / `demo1234`. The seed also
creates additional public profiles for the verified trader directory.

## Important Files

- `CLAUDE.md` - architecture and guardrails
- `MVP2.md` - living research profile plan/status
- `TODO.md` - backlog and caveats
- `prisma/schema.prisma` - data model
- `src/lib/metrics.ts` - code-of-record metrics engine
- `src/lib/trust.ts` - research score and risk layer
- `src/lib/ingest/import.ts` - source-history write path
- `src/lib/published-profile.ts` - public snapshot reconstruction
