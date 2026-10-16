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
