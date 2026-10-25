# SVAN prop-firm site review

Reviewed 16 October 2026 for the requested prop-first repositioning of WhiteSVAN.
This file records source evidence and the checks needed for this implementation.

## Product and design

- Keep the existing forest background, lime accents, Space Grotesk and IBM Plex Mono.
- Put the evaluation proposition, plan comparison, pathway, rules and FAQs ahead of the journal.
- Keep journal, source imports, published records and discovery available as secondary tools.
- Use Tradeify's public journey as the requested structural reference; SVAN's name, market scope and programme claims must describe SVAN.
- The existing functioning system is an authenticated journal, source-file importer, metrics/reporting engine, public profile directory and sample Academy. There is no payment processor, genuine trading simulator, persistent evaluation account, payout processing or contractor selection engine in the current Prisma schema.

## Source of proposed programme terms

Local planning source: `PROP_FIRM_V2/SVAN_India_v4_Notion/02 Product v4 - India Tabs, Rulebook and Copy Desk.md`.
Its rulebook and contractor terms are explicitly drafts for beta calibration and counsel review.

| Proposed tier | Simulated balance | Fee incl. GST | Profit target | Maximum loss | Daily loss | Max lots |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ₹1,00,000 | ₹2,999 | ₹6,000 | ₹4,000 | ₹2,000 | 1 |
| 2 | ₹2,50,000 | ₹4,999 | ₹15,000 | ₹10,000 | ₹5,000 | 2 |
| 3 | ₹5,00,000 | ₹8,999 | ₹30,000 | ₹20,000 | ₹10,000 | 4 |
| 4 | ₹10,00,000 | ₹14,999 | ₹60,000 | ₹40,000 | ₹20,000 | 8 |

- Proposed minimum: five trading days. Best day at passing: at most 50% of total profit.
- Maximum loss trails the highest end-of-day balance and locks at the starting balance; a simple historical closed-P&L exercise does not establish intraday breaches.
- Draft Level 1 rewards are 80% of eligible simulated net profit, after a buffer, review and per-cycle caps. Contractor accounts remain simulated permanently. Optional firm copying is a separate planned activity using the firm's own account.
- Proposed prices, rewards, approval windows and payout frequency are not evidence of an operational paid programme.
- Do not invent payout totals, user counts, testimonials, Trustpilot ratings, partner logos, guaranteed capital, guaranteed offers, live integrations or measured service speed.
- Do not hardcode current exchange lot sizes, tax rates or expiry rules into this UI refresh. Those need a dated contract master and separate verification.

## Experience checks

- Public navigation works on narrow screens and makes programme selection the main action.
- Pricing controls change visible tier amounts and retain an accurate simulated/draft label.
- Every CTA ends at an existing route, a working beta form, or a clearly described sample exercise.
- Plan-selection actions do not imply checkout, payment collection or real evaluation activation.
- Auth screens identify the SVAN programme and journal workspace clearly; existing trader/client accounts and access controls still work.
- The journal remains reachable without dominating the public header or authenticated programme landing.
- Keyboard focus, form labels, reduced motion, FAQ expansion, active navigation and mobile menu behavior remain usable.

## Validation and deployment

- Installed version: Next.js 16.2.9, React 19.2.4. Consult the local `node_modules/next/dist/docs/` before route or API work. In this version `params` and `searchParams` are promises.
- Run TypeScript, ESLint and relevant existing unit tests after implementation.
- For a local production build, call the Next CLI directly after Prisma client generation. The repository's `npm run build` includes `prisma migrate deploy`; do not run it merely to validate a presentation change against an unknown database.
- Smoke-check `/`, `/academy`, programme routes, `/login`, `/signup` and unauthenticated protected-route redirects, then inspect desktop and mobile rendering.
- Repository remote: `https://github.com/WhiteSVAN/WhiteSVAN.git`.
- Existing review identifies `https://white-svan.vercel.app/` as the live app. No `.vercel` project link or `vercel.json` was present at reconnaissance. Confirm the connected Vercel project and deployment result before reporting the new version live.

This reconnaissance does not itself verify or deploy the new UI. Record actual implementation and validation results in the final handoff.

## Checkpoint, 16 Oct 2026 09:15 IST (Claude, after Codex)

Founder direction: copy MFFU / Tradeify / Topstep wording ("nobody words it like that"). Use industry
terms (evaluation, funded account, profit split, payouts, max drawdown, "Get funded") with our own
sentences and our real draft numbers; disclose simulated accounts in the FAQ and footer as those firms do.
Keep the forest/lime colours. Never invent stats, payout totals, ratings or testimonials.

Done:
- `/help` help center (was a dead link from header, landing, dashboard, payouts and nav):
  `src/app/help/page.tsx`, searchable `src/components/prop-firm/help-center.tsx`, content and search in
  `src/lib/help-center.ts` (+ tests). Figures come from `src/lib/prop-firm.ts`.
- Industry-style copy: header (Pricing, Rules, Log in, "Get funded"), pricing cards with an
  Evaluation / Funded toggle, landing hero ("Pass. Get funded. Get paid."), steps, rules block, FAQ.
- Launch-list form restyled (`src/app/waitlist-form.tsx`) and placed on the landing CTA, help page and
  dashboard (prefilled email). It writes `WaitlistEntry`.
- Footer rewritten for the prop firm, with standard disclaimers.
- Brand: every user-facing "TrustSVAN" / "White SVAN" is now "WhiteSVAN" (generated Prisma code untouched);
  research-profile disclaimers re-scoped to the journal tools.
- Academy uses the shared prop header; "consultant" wording is now "contractor"; journal links go to `/journal`.
- `/artifacts/` (deck build output) added to `.gitignore`.
- Checks: `tsc` clean, `eslint src` clean, `vitest` 244 passed / 3 skipped.

Deployed: commit `c08fede`, PR #35, merged into `main` as `7e06cd2` and live on white-svan.vercel.app.
The PR was opened and merged within seconds of the push by an integration outside this repo (no
workflow file), so any push to this repository can reach production.

## Completion pass, 16 Oct 2026 (Claude)

Done:
- Industry wording everywhere public: `/evaluations` (new Evaluation vs Funded comparison table, which
  lists only rules the rulebook defines), `/evaluations/[plan]` (checkout-style card; "Start evaluation"
  goes to `/signup?plan=<id>`), `/rules` (contents read each section's `label`), help-center answers,
  `RULE_SECTIONS`, footer, help page, Academy (hero, tabs "Lessons / Rule practice / Getting funded",
  lesson 4 rewritten as "How the evaluation and funded account work").
- Landing: "Built for India" section (rupee pricing, bank payouts, NSE/BSE contracts, Indian costs,
  IST hours, DigiLocker KYC), the Tradeify "why us" slot without claims about other firms; rupee icons;
  ₹5L card badge is "Recommended" (not "Most popular": there are no sales to back that).
- Sign-up: trader role by default (picker only with `?as=client`), plan banner for `?plan=`, Google
  button passes the trader role; onboarding copy and India placeholders.
- Signed-in: workspace top bar, My accounts, Payouts copy in the same voice.
- Optional Discord link (`NEXT_PUBLIC_DISCORD_URL`, documented in `.env.example`).
- CLAUDE.md and README rewritten for the prop firm, with the journal as secondary tools.
- Visual check of every public page at 1440 px and 390 px with headless Chrome; fixed the pricing-card
  alignment, mobile stats dividers and the mobile announcement bar.

Still to build (Notion TRD and sprint stories): checkout, evaluation provisioning, simulator and
licensed data, rule engine, KYC, payouts with TDS, optional copy desk.

## Trading core, 16 Oct 2026 (Claude)

Built against the Notion TRD (SIM, RULE, PAY-2) as pure TypeScript in `src/lib/trading`, with no
vendor choice needed:
- Paise money and integer rates; dated charge schedules (Zerodha F&O rate card read 16 Oct 2026,
  STT 0.05% futures / 0.15% options premium on the sell side). Marked `verified: false` until a real
  contract note matches (story S3-01).
- Order matching (market, limit, SL, SL-M against five-level depth, slippage, partial fills), FIFO
  positions, square-off at 15:20, day close at 15:30, expiry-day cutoff, lot limits, naked-short ban.
- Rule engine: daily loss on open plus closed P&L, trailing end-of-day drawdown that locks at the
  starting balance, pass on target + 5 days + consistency, breach report with the trade or price.
  Touching a limit counts; the rulebook copy now says "Hitting either limit ends the account".
- Risk meters for the dashboard, a payout quote (80% above the buffer, capped, one request per
  half-month) and deterministic replay from the start or a JSON snapshot.
- The Academy's rule practice now runs the real rules for each account size instead of classroom
  limits.

Still open from those stories: contract-master ingestion, the engine service (Node, Redis, replay
and vendor feeds, realtime gateway), checkout, provisioning, KYC and e-sign, payout processing.

Local tooling: Node is not on PATH on the founder's machine; use the portable Node 22 at
`%LOCALAPPDATA%\Temp\whitesvan-tooling\node-v22.23.3-win-x64` (prepend it to PATH in PowerShell).
For local build checks use `npx prisma generate && npx next build` (not `npm run build`).

## Codex verification and stopping point, 16 October 2026

The user requested the highest-impact work within the remaining usage, documentation and a stop.
During verification the shared checkout advanced to `feat/trading-core`, commit `926dcdf`.
The newer committed Claude implementation was preserved; overlapping temporary help/footer edits
were discarded. No PR was merged, branch pushed, deployment triggered or database migrated by this pass.

Current repository evidence:
- PR #35: prop-firm storefront and journal moved to Tools.
- PR #36: industry wording, plan-aware signup, Academy, help and documentation refinements.
- PR #37: deterministic trading core, rule engine, simulated fills, charges and payout quotes.
- GitHub search found no debt-investor pitch-deck PR in `WhiteSVAN/WhiteSVAN`; its repository or PR
  URL is needed to identify that separate work. Do not assume app PR #37 is a pitch-deck change.

Validation rerun against the current code:
- TypeScript passed; production build also completed its TypeScript check.
- Full `eslint src` passed; `git diff --check` passed.
- Vitest: 300 passed, 3 skipped. The skipped cases are not evidence of working database integrations.
- Direct `next build`: passed, 36 routes. The first sandboxed attempt could not fetch Google Fonts;
  the network-enabled build passed without database migrations.
- No fresh visual browser check was completed in this pass; the connected browser inventory was empty.
  Prior Claude visual checks above are retained as prior evidence, not claimed as new verification.

Remaining delivery work stays as listed in the trading-core checkpoint: service/feed integration,
contract-master ingestion, checkout, account provisioning, KYC/e-sign and payout processing.
The storefront and pure trading library do not by themselves activate those services.

## Site pass, 16 Oct 2026 (Claude)

- New public pages for story S6-04: `/how-it-works` (four steps and the IST trading day, with times
  from `PROGRAMME_RULES`) and `/funded` (funded accounts, payout rules, caps and buffers by account
  size, and a payout calculator on `payoutAmounts` from the trading core).
- Header gains "Payouts" (to `/funded`); "How it works" now goes to the page; footer, pricing-card
  funded CTA and the landing steps link to the new pages. `FUNDED_STEPS` moved to `prop-firm.ts`.
- SEO: `sitemap.ts`, `robots.ts` (workspace routes disallowed), a storefront share image,
  `metadataBase` and industry-voiced home metadata. Optional `NEXT_PUBLIC_SITE_URL`.
- Academy rule practice shows one card per day on phones instead of a sideways-scrolling table.
- Checked at 1440 px and 390 px. Still missing for story S3-04: terms, refund, privacy and contact
  pages. They need counsel's text and a support contact, so they are not drafted here.

## Zerodha charts, 17 Oct 2026 (Claude)

- `/markets` (Tools → Zerodha charts) charts NIFTY, BANK NIFTY and SENSEX (index, futures and
  options) from the firm's own Kite Connect account: candles from 1 minute to 1 day, volume and
  open-interest panes, live quotes every 2 seconds in market hours and five-level depth.
- Own use only. Zerodha's API FAQ: "Displaying or redistributing Kite Connect API data on external
  platforms violates exchange data vending policies." The page and its API routes are a 404 for
  everyone outside `KITE_OWNER_EMAILS`, and Kite only lets the app's own client ID log in. Trader
  charts and the evaluation engine still need the licensed feed in the Notion data plan.
- The chart component and candle code are source-agnostic, so trader screens can reuse them on a
  licensed feed. `toEngineQuote` maps Kite depth into the trading core's `Quote`.
- The day's access token is sealed (AES-256-GCM) in an HTTP-only cookie that expires at Kite's
  06:00 IST logout; it is never stored in the database or shown to page scripts.
- Checked end to end against a stand-in Kite server on a temporary Postgres: sign-in, the Kite login
  round trip, index, futures and options charts, intervals, live updates, depth, phone layout,
  disconnect, and a non-owner getting 404s with no menu link.
- To switch it on: create a Kite Connect app (₹500 a month) on the firm's client ID, set its
  redirect URL to `https://white-svan.vercel.app/api/zerodha/callback`, and add `KITE_API_KEY`,
  `KITE_API_SECRET` and `KITE_OWNER_EMAILS` in Vercel.

## Checkout, accounts and the trading platform, 18 Oct 2026 (Claude)

- The buying journey follows Tradeify: pricing card "Start evaluation" → `/checkout/<plan>`
  (details, agreements, payment, order summary) → `/checkout/complete/<order>` → "Start trading" →
  `/trade/<account>`. Signed-out buyers sign up with the plan and land back on checkout; sign-in
  honours `?next=`; traders no longer need a journal profile to buy or reach My accounts.
- No payment gateway is signed (TRD: Razorpay or Cashfree; go-live register IN25), so checkout is
  closed to the public with the launch list. `STAFF_EMAILS` can make test purchases that open a real
  account without a charge. Orders are stored with amount, billing and GST place of supply.
- New tables `EvaluationAccount` (engine snapshot, optimistic locking) and `CheckoutOrder`
  (migration `20261018022652_evaluation_accounts_checkout`, additive).
- `/trade/<account>`: chart, ticket, positions, orders, fills, activity and rule meters, with the
  engine on the server (`/api/accounts/<id>/tick` and `/orders`). Prices come from the firm's Kite
  session, so only `KITE_OWNER_EMAILS` trade today; other traders see their account waiting for live
  prices. The earlier in-browser test desk is replaced by these stored accounts.
- Loose ends tied: migrations use `DATABASE_URL_UNPOOLED` (the P1002 lock failure on 17 Oct); email
  goes through Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set, with order confirmations; the
  storefront header shows "My accounts" when signed in; `/checkout` and `/trade` are kept out of search.
- Checked end to end against the Kite stand-in on a UTF-8 Postgres: 19 checks from the signed-out
  plan card through test purchase, Zerodha login, a filled order, close, reload and My accounts, plus
  public checkout closed, sign-up straight to checkout, the no-data platform and another trader's 404.
- Still to do: a gateway (UPI/cards) with GST invoices and refunds, the always-on engine service with
  a licensed feed, KYC, payouts, and counsel's terms, privacy, refund and contact pages (S3-04).
- Product note: on the ₹1L plan one NIFTY futures round trip costs about ₹1,100 in charges, over half
  the ₹2,000 daily loss limit, so small accounts effectively trade options.

## Zerodha charts for every signed-in user, 24 Oct 2026 (Claude)

- Founder's decision: the firm's Kite login now serves every signed-in user's `/markets` charts and
  `/trade/<account>` platform, not just `KITE_OWNER_EMAILS`. The founder made the call after being
  shown that Zerodha's terms bar showing Kite data to other people and that NSE's data policy
  (cl. 8.4) bars market data for virtual trading. It rests on the platform staying private.
- How it works: an owner's Kite login is stored sealed (AES-256-GCM) in a new `KiteConnection` row
  (migration `20261024120000_kite_connection`, additive) instead of a browser cookie. Any signed-in
  user's requests read through it, and only owners connect or disconnect it. After Kite's 06:00 IST
  logout, owners get the login card and everyone else gets "Live prices are offline".
- One login for everyone: `src/lib/zerodha/throttle.ts` sends one Kite quote call a second for all
  screens together, spaces historical calls at 3 a second, and reuses chart history for 15 s. The
  limits hold per server instance.
- The login can trade the firm's real Zerodha account, so `client.ts` keeps to market-data calls
  and the token never reaches a browser.
- Checked end to end with two browsers against the Kite stand-in on a temporary Postgres, 29
  checks. An owner connects. A trader who isn't an owner gets live index and futures charts with
  depth, buys a test evaluation and fills a market order. The trader can't log in to Kite or
  disconnect it, and no response or cookie carries the token. Two screens polling for 12 s made 7
  Kite quote calls at least 1.05 s apart, with no 429s. After Kite's logout the trader waits while
  the owner reconnects, and disconnecting turns prices off for everyone.
- After deploying, an owner logs in to Kite once on `/markets`. The old per-browser cookie is no
  longer read.

## Buy/Sell on the charts and the order book, 24 Oct 2026 (Claude)

- Founder's choices: Buy/Sell trades evaluation accounts only (no free practice accounts), and F&O
  only for now; stocks come later.
- `/markets` is now the trading platform for the trader's active evaluation account, with an
  account picker for several. Buy and Sell sit in the chart header; they set the ticket's side, and
  are disabled on the index. Without an account they point to "Open an evaluation".
- Order management: open orders can be modified (lots, limit, trigger) or cancelled. A new Order
  history tab lists complete, cancelled and rejected orders with average price and reason. The
  history comes from `Desk.orderBook`, kept by `deskStep` from the engine's outputs; desks stored
  earlier start an empty book.
- Engine: a pure `modify` event, checked like a new order and never below what has filled.
  `PATCH /api/accounts/<id>/orders/<orderId>` sends it against a fresh quote.
- Checked with unit tests (engine, desk, ticks) and a two-browser end-to-end run against the Kite
  stand-in, 23 checks: account switching; Buy/Sell; limit order modified, then filled; stop
  modified, then cancelled; a rejected naked short; history after a reload; the phone layout; and
  the no-account card.

## Demo evaluations on virtual credit, 24 Oct 2026 (Claude)

- Founder's decision, for demos while no payment gateway is signed: a demo wallet, not free
  accounts. Every user has ₹50,000 of virtual credit (`DEMO_CREDIT` in `src/lib/checkout/demo.ts`)
  and buys evaluations at the normal prices with it, so the whole purchase flow can be shown.
- Checkout has three modes (`config.ts`): staff `test`, everyone else `demo`, or `closed` with
  `DEMO_CHECKOUT = false`. A demo purchase spends the credit in the same transaction that opens
  the account, conditional on enough being left, so double clicks can't overspend.
- Migration `20261024150000_demo_evaluations` (additive): `User.demoCreditSpent` (paise) and
  `EvaluationAccount.demo`. Orders keep the plan price with provider `"demo"`.
- Demo accounts are labelled Demo on My accounts, the trading page, the ticket and the account
  picker. Passing one says it doesn't move to a funded account, and the confirmation page and
  email say nobody was charged.
- Storefront copy says "Demo open". This covers the announcement bar, the hero, pricing, the
  plan pages, rules, FAQs, help, the footer disclaimer and the app's top bar, so nothing says
  evaluations can't be bought yet.
- Checked with unit tests and an end-to-end run against a fresh Postgres, 19 checks:
  - buying three ₹10L evaluations down to ₹5,003, then the 3-account cap;
  - a short balance refused in the browser, and by the server when the button is forced;
  - staff still making test purchases;
  - the storefront copy and the phone layout.

## Three steps to a paid evaluation, 25 Oct 2026 (Claude)

- Founder's direction: the rule of three, with as few steps as possible before a trader pays, and
  no size to pick before creating an account. The path is now 1. create your account, 2. choose
  the size, 3. pay: three actions for a new visitor (Get funded, Create account, Pay).
- Every "Get funded" and "Start your evaluation" button goes to `/checkout`. Signed out, that's
  sign-up first (`/signup?next=/checkout`), which asks for no size. Sign-up sends traders straight
  on to checkout (a `?next=` wins, so the journal's "Build your record" links keep going to the
  journal). Signed in, `/checkout` opens on `startingPlan`: the Recommended ₹5L
  (`RECOMMENDED_PLAN` in `prop-firm.ts`, which the pricing cards mark too), or the largest size the
  demo credit still covers. Pricing cards still open their own size.
- Checkout is one screen. Step 2 picks the size in place: the summary, credit and Pay button follow
  it, the address follows through `history.replaceState`, and the form posts it as `plan`. Step 3
  is name (from sign-up), mobile, state, the agreement and Pay. The details come from the trader's
  last order, and a refused checkout keeps what was typed (a keyed `<select>`, because React resets
  the form after each submission). The agreement is never pre-ticked. `StartSteps` shows the three
  steps on sign-up and checkout.
- Google sign-ups land on `/onboarding/continue`, which applies the trader role the sign-up page
  asked for and continues to checkout, skipping the role picker and the journal-profile form. The
  picker, when it still shows, sends traders on to checkout too. Google sign-in isn't switched on
  in production yet.
- Step lists are threes: How it works (start, pass, get funded and get paid, three points each),
  "From pass to payout" (`FUNDED_STEPS`), the landing and evaluations steps, and a help article,
  "How do I start an evaluation?".
- Checked with unit tests and an end-to-end run against a fresh Postgres, 38 checks: the three
  actions from Get funded to a paid order, switching size without a reload, refused checkouts
  keeping their details, the prefilled second order, the starting size on low credit, the account
  cap, the pricing-card and sign-in paths, journal sign-ups, the Google landing route (with and
  without a role), staff test purchases and 375px phone widths.

## Simplified, in threes, 25 Oct 2026 (Claude)

Founder's list: clean up AI slop, the rule of three (three indices, three sizes, three steps), the
steps as pass, get funded and get paid, fewer steps to paying, no Zerodha on the site, and less
journal.

- **Three sizes:** ₹1L, ₹5L (Recommended, the checkout default) and ₹10L. ₹2.5L is retired:
  `findEvaluationPlan` (on sale) no longer finds it, `findAccountPlan` keeps existing ₹2.5L
  accounts and receipts working.
- **One three-step story:** `PROGRAMME_STEPS` (pass the evaluation, get funded, get paid) on the
  landing page, How it works, the funded page and the Academy.
- **Lists of three:**
  - the hero rules card, the at-a-glance stats and the Built-for-India points;
  - the pricing card rows and the plan-page limits;
  - How it works (three points per step, three moments in the trading day, three questions);
  - the funded facts and payout rules;
  - the help center (19 articles in 3 topics) and the Academy (3 lessons);
  - the storefront nav (How it works, Pricing, Rules) and the workspace tabs (My accounts, Charts,
    Payouts).
- **Fewer steps to paying:** checkout no longer asks for a name (it comes from the account), so
  step 3 is mobile, state, the agreement and Pay.
- **AI slop removed:**
  - the landing page's "interactive demo" with an illustrative equity curve and P&L;
  - the rules card's meter bars at arbitrary widths;
  - the resources section and duplicate demo lines;
  - slogan filler ("No surprises", "Ready when you are", "Still deciding?", "Here's exactly…");
  - terminal-style labels on the auth screens;
  - the repeated steps section on Evaluations.
- **No Zerodha or Kite in anything users read:**
  - charts are "Charts", and errors and notices say "the price feed" or "live prices";
  - the owner's button says "Connect live prices", and the `?zerodha=` notice is now `?feed=`;
  - code, env vars and the `/api/zerodha/*` routes keep their names (the callback URL is registered
    with Kite).
- **Journal and track record switched off:**
  - `next.config.ts` redirects their routes to My accounts or home;
  - the Tools menu, the dashboard journal panel, the footer column, the journal FAQs, the Academy
    journal prompts, client sign-up and the role picker are gone;
  - every account is a trader, and a role-less sign-in becomes one in place;
  - Settings is just name and email.
- **Gotcha found while testing:** redirecting a page render to a route handler during a client
  navigation runs the handler twice. `requireMember` therefore sets the trader role in place instead
  of bouncing through `/onboarding/continue`.
- **Checks:** 405 unit tests, type-check, lint and build all pass. An end-to-end run against a fresh
  Postgres passed 31 checks:
  - the journal redirects, and no Zerodha/Kite/journal/illustrative text on ten public pages;
  - every three on the storefront;
  - the funnel without a name field;
  - the nav, account menu and settings;
  - a ₹2.5L account still opening;
  - role-less and Google sign-ins;
  - 375px phone widths.
