# WhiteSVAN

WhiteSVAN is an India-first prop trading firm for NIFTY, BANK NIFTY and SENSEX options.
Traders learn with SVAN Academy, take a one-time-fee simulated evaluation (₹1L, ₹5L or ₹10L, 6%
profit target, 4% end-of-day drawdown, 2% daily loss limit), and those who pass get a simulated
funded account with an 80% profit split. Payouts can be requested whenever eligible profit is earned,
subject to the buffer, per-request cap and verification requirements.

Pricing, rules, the help center and free Academy lessons are available. Checkout opens evaluations
free of charge when Razorpay keys are absent, or uses Razorpay Standard Checkout when configured.
Passing an evaluation opens one simulated funded account. Payout figures are shown, but KYC,
agreements, bank verification and payout processing are not built yet.
The trading core (simulated orders and fills, Indian F&O charges, the rule engine, risk meters and
payout quotes) is in `src/lib/trading` as tested, deterministic TypeScript. All evaluation and funded accounts are
simulated. Nothing on the site is investment advice, and public pages keep the past-performance
disclaimer.

The original trader-verification journal (formerly TrustSVAN) and the Zerodha track record are
switched off: `next.config.ts` redirects their routes, and their code stays in the repo.

## Current Stack

- Next.js 16 App Router, React 19, TypeScript
- Prisma 7 with generated client in `src/generated/prisma`
- Postgres 16 (Docker Compose locally)
- NextAuth v5 (credentials and Google)
- Tailwind v4, Recharts, TradingView Lightweight Charts (price charts)
- OpenAI by default, Anthropic via `AI_PROVIDER=anthropic` (journal briefs)
- Vercel: production from `main` at https://white-svan.vercel.app

Temporal Cloud setup, worker commands and deployment instructions: [docs/temporal.md](docs/temporal.md).

## Prop-firm site

- `/`: landing page laid out like Topstep's (a centred hero with stat cards, how it works, pricing
  with an Evaluation / Funded toggle, built for India and FAQ). No risk rules outside the pricing
  cards: they're on `/rules`.
- `/evaluations` and `/evaluations/[plan]` (`1l`, `5l`, `10l`): pricing and plan detail.
- `/how-it-works`: the three steps to a payout and the three steps to start.
- `/funded`: funded accounts, caps and buffers by account size and a payout calculator.
- `/rules`: the rulebook, the one place every rule is written: the rules in one minute, then four
  groups of three (to pass, to keep your account, to get paid, on the platform), each rule in plain
  words with the amounts for the chosen size and then exactly, and every size side by side. Other
  pages link here instead of repeating rules. `/help`: searchable help center. `/academy`: free
  lessons, rule practice and "getting funded".
- Buying is three steps on one screen: your account, your size, check out. "Get funded" goes to
  `/checkout`, which opens on the recommended size, signed in or not. Signed out, the same submission
  creates the account from an email and a password (or signs in to an existing one; Google works
  too), then opens the evaluation and lands on `/trade/<account>` with a welcome; the receipt is at
  `/checkout/complete/<order>`. Pressing the button accepts the rules. Without both Razorpay keys,
  checkout asks for nothing more and records provider `free`, amount ₹0 and no payment taken. With
  keys, it also asks for a mobile number and state (the GST place of supply), creates a pending
  Razorpay order and opens the account only after the server verifies capture or receives a signed
  captured webhook. Sign-ins in `STAFF_EMAILS` always make uncharged test purchases. Virtual demo
  credit is retired; evaluation accounts are called demo accounts because their trading is simulated.
- Themes: White and Dark, in the Manus style, following the device until a visitor picks one (the
  header toggle, the footer and the account menu). Every colour is a token in
  `src/app/globals.css`; [docs/theme.md](docs/theme.md) lists them for touch-ups.
- `/trade/<account>`: the options trading platform for an evaluation or funded account: an option chain
  with Buy and Sell on every strike, an index chart first (switch to an option's chart and depth),
  the order ticket (Market, Limit, Stop-loss, and a stop-loss and target on any buy, each cancelling
  the other), the position's average, stop-loss and target drawn on the chart, fill alerts,
  today's positions with realised and open P&L, orders you can modify or cancel, trades, and the rule
  meters, with the engine running on the server. `/markets` (the Trade tab) offers the same for the
  trader's active account. Directional bets only: buy calls or puts and sell only to close them; no
  short options, spreads, or calls and puts on the same index together (across accounts too).
- `/journal`: total P&L, win rate and trades, a P&L calendar by day with weekly totals, and a note
  for any day.
  Prices come from the firm's shared Zerodha login, so every account holder trades while an owner
  has it connected.
- My accounts shows evaluation and funded account cards. Passing an evaluation opens its funded
  account once, in the same database transaction; trader and staff notifications follow.
  `/payouts` shows each funded account's buffer, profit split, cap and eligibility prerequisites, without
  submitting a request or transferring money.
- Signed-in workspace: My accounts, Trade (when live prices are configured) and Journal; Payouts,
  Academy, Help and Settings in the account menu.
- `/markets` (the Trade tab): charts, live quotes and depth from the firm's Zerodha account
  through Kite Connect, for every signed-in user. A `KITE_OWNER_EMAILS` sign-in logs in to Kite once
  a day (Kite ends the login at 6 AM IST) and everyone reads through that login. Set
  `KITE_API_KEY`, `KITE_API_SECRET` and `KITE_OWNER_EMAILS`, and register
  `<site>/api/zerodha/callback` as the Kite app's redirect URL.
- Programme numbers and rule text live in `src/lib/prop-firm.ts`; change them there only.
- Optional: set `NEXT_PUBLIC_DISCORD_URL` to show a Discord link in the header and footer, and
  `NEXT_PUBLIC_SITE_URL` when a custom domain goes live (sitemap, robots and share images).

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

## Payment activation

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to use Razorpay Checkout. Use test-mode keys
for demos and gateway tests: with a `rzp_test_` key, checkout shows Razorpay's test UPI ID and card,
orders are recorded as `razorpay-test`, and the confirmation and receipt say no money was charged. Before accepting real payments, configure live-mode keys, enable automatic
capture in Razorpay Dashboard, and add `<site>/api/razorpay/webhook` for `payment.captured` and
`order.paid`, with `RAZORPAY_WEBHOOK_SECRET` matching the dashboard webhook secret. The browser's
signature alone does not mark an order paid: the server also checks captured status, order, INR
currency and amount. A signed captured webhook completes an order even if its browser never returns.
The local stand-ins and integration tests do not verify real payment capture, settlement or refunds.
GST invoices, refund processing, KYC and actual payouts remain separate work.

Demo after seeding: `/p/demo`, login `demo@trustsvan.local` / `demo1234`. The seed also
creates additional public profiles for the trader directory.

## Important Files

- `CLAUDE.md` - architecture, programme boundaries and guardrails
- `docs/prop-firm-repurpose-review.md` - prop-firm repurpose handoff and checks
- `src/lib/prop-firm.ts` - programme numbers and rule text
- `src/lib/help-center.ts` - help-center content and search
- `src/lib/trading/` - simulator and rule-engine core (paise money, charges, matching, rules, payouts)
- `src/lib/zerodha/`, `src/lib/market-data/`, `src/components/markets/` - Zerodha charts and candles
- `src/components/prop-firm/` - storefront components
- `prisma/schema.prisma` - data model
- `src/lib/metrics.ts` - code-of-record metrics engine (journal)
- `src/lib/trust.ts` - research score and risk layer (journal)
- `src/lib/ingest/import.ts` - source-history write path (journal)
