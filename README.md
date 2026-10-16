# WhiteSVAN

WhiteSVAN is an India-first prop trading firm for NIFTY, BANK NIFTY and SENSEX futures and options.
Traders learn with SVAN Academy, take a one-time-fee simulated evaluation (₹1L–₹10L accounts, 6%
profit target, 4% end-of-day drawdown, 2% daily loss limit), and those who pass get a simulated
funded account with an 80% profit split, paid twice a month in rupees.

The site is launching soon: pricing, rules, the help center and free Academy lessons are live;
checkout, evaluation accounts and payouts are not built yet. All evaluation and funded accounts are
simulated. Nothing on the site is investment advice, and public pages keep the past-performance
disclaimer.

The original trader-verification journal (formerly TrustSVAN) still ships as secondary tools under
the signed-in **Tools** menu: imports, metrics, research profiles, AI briefs and the trader directory.

## Current Stack

- Next.js 16 App Router, React 19, TypeScript
- Prisma 7 with generated client in `src/generated/prisma`
- Postgres 16 (Docker Compose locally)
- NextAuth v5 (credentials and Google)
- Tailwind v4, Recharts
- OpenAI by default, Anthropic via `AI_PROVIDER=anthropic` (journal briefs)
- Vercel: production from `main` at https://white-svan.vercel.app

## Prop-firm site

- `/`: landing page (hero, how it works, pricing with an Evaluation / Funded toggle, rules, built for
  India, free resources, FAQ, early-access signup).
- `/evaluations` and `/evaluations/[plan]` (`1l`, `2-5l`, `5l`, `10l`): plans, evaluation vs funded
  comparison and plan detail.
- `/rules`: full rule table and sections. `/help`: searchable help center. `/academy`: free lessons,
  rule practice and "getting funded".
- `/signup?plan=<id>`: plan-aware trader sign-up. Firms and allocators use `/signup?as=client`.
- Signed-in workspace: My accounts, Evaluations, Payouts, Academy and Help, with the journal under Tools.
- Programme numbers and rule text live in `src/lib/prop-firm.ts`; change them there only.
- Optional: set `NEXT_PUBLIC_DISCORD_URL` to show a Discord link in the header and footer.

## Core Rules

- All evaluation and funded accounts are simulated; traders never receive live capital or pay deposits.
- No tips, calls, signals or return promises; never invent stats, ratings, testimonials or payout totals.
- Code calculates numbers. AI only explains already-computed metrics.
- Public performance reads from published `ProfileVersion` snapshots, not live source loads.
- Source-history hashes are recorded and duplicate source files are rejected per account.
- Privacy redaction affects public display only; metrics are not recalculated.

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

`npm run build` runs `prisma migrate deploy`; for a local build check use
`npx prisma generate && npx next build`.

Demo after seeding: `/p/demo`, login `demo@trustsvan.local` / `demo1234`. The seed also
creates additional public profiles for the trader directory.

## Important Files

- `CLAUDE.md` - architecture, programme boundaries and guardrails
- `docs/prop-firm-repurpose-review.md` - prop-firm repurpose handoff and checks
- `src/lib/prop-firm.ts` - programme numbers and rule text
- `src/lib/help-center.ts` - help-center content and search
- `src/components/prop-firm/` - storefront components
- `prisma/schema.prisma` - data model
- `src/lib/metrics.ts` - code-of-record metrics engine (journal)
- `src/lib/trust.ts` - research score and risk layer (journal)
- `src/lib/ingest/import.ts` - source-history write path (journal)
