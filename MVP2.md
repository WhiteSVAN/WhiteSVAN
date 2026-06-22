# TrustSVAN - Living Research Profile

> **What this is:** a running record of what TrustSVAN does today and the plan to take it
> from a static performance record to a living, timestamped, trader-readable research profile.
> Source of truth for tech remains [CLAUDE.md](CLAUDE.md) + the code; the MVP2 brief PDF is a
> **draft** - where its table/field names disagree with our schema, we adapt the *capability*
> onto our existing models rather than copying its names.

**Product guardrail (unchanged, load-bearing):** reporting & analytics software only. No trade
execution, no copy-trading, no investment advice, no client-money handling, no "best/recommended/
guaranteed/safe trader" language. Every public page keeps the *"past performance does not guarantee
future results"* disclaimer.

---

## 1. Where we are today (MVP1 — complete)

The MVP1 product (milestones M1–M6 + trust features) is built and working:

| Area | Status | Notes |
| --- | --- | --- |
| Auth & app shell | ✅ | NextAuth v5 (credentials + JWT), DAL, `/login` `/signup` `/onboarding`, protected layout |
| CSV import | ✅ | `/upload`: account → file → auto-mapped preview → import → `DailyPnl` rebuild. IBKR Flex/Activity, manual template, Fidelity & E\*TRADE realized-G/L; FIFO matcher for retail transaction exports |
| Metrics + dashboard | ✅ | Equity curve, daily P&L, account/range filters, risk panel — all from [metrics.ts](src/lib/metrics.ts) (pure, code-of-record) |
| TrustSVAN dashboard | done | **Research view** and **Trader metrics view** ([trust.ts](src/lib/trust.ts)): Big-Win Dependency, Biggest-Drop severity, Bounce-Back Time, sub-scores + Transparency Score + verdict |
| AI briefs | done | `/reports`: generate (OpenAI default / Claude), edit with live compliance, then publish. Strict system prompt + banned-language filter ([compliance.ts](src/lib/ai/compliance.ts)) |
| Operator card | done | Public `/p/[slug]`, public/private toggle + share link, Print / Save-PDF |
| Launch surface | ✅ | Landing + waitlist capture, seeded demo at `/p/demo`, public directory `/explore` |
| Professional network | ✅ | Authenticated `/network` surface for trader-to-trader discovery, rooms, structured signal/counterview prompts, and proof-backed member cards |
| Evidence & Proof Levels | ✅ | Evidence locker + dynamic Proof Levels ([proof.ts](src/lib/proof.ts)): CSV = L2, broker statement = L3. `/settings` upload + serve |
| Redaction (basic) | ⚠️ | Single `hideAmounts` boolean only — MVP2 makes this granular |
| Transparency breakdown + calendar heatmap | ✅ | Weighted sub-scores in UI + monthly heatmap |

---

## 2. Current product goal

A living research profile and research network that helps traders, prop firms, independent traders,
brokers, and quant research teams share factual performance records, GEX briefs, portfolio research,
and stock deep dives. It
tells a professional peer, at a glance:

- **How fresh** the data is (last updated, coverage, freshness status, next expected update).
- **Where it came from** (source type, file fingerprint, proof level).
- **What changed** since the last update (plain-English change summary).
- **What risk events** were triggered (drawdown, worst-day, big-win dependency, stale, score-change).
- **How consistently** the trader reports (update cadence adherence).

---

## 3. MVP2 status — feature by feature

Legend: ✅ done · 🟡 partial / foundation exists · ⛔ not started

| MVP2 capability | Status | What exists today / what's missing |
| --- | --- | --- |
| **Profile freshness** (last-updated, coverage, fresh/getting-stale/stale) | ✅ | [freshness.ts](src/lib/freshness.ts) (pure + tested) drives a status card on `/dashboard`; `lastPublishedAt` on the profile |
| **Update cadence** (daily/weekly/monthly/manual) | ✅ | `UpdateCadence` enum on `TraderProfile`; selector in `/settings` |
| **Upload history** (hash, row count, period, P&L per import) | ✅ | `ImportBatch` model written by [import.ts](src/lib/ingest/import.ts) (sha-256 [hash.ts](src/lib/hash.ts), row count, period, net P&L); table in `/settings` |
| **Profile versions** (immutable snapshot per publish) | ✅ | `ProfileVersion` + Publish action ([dashboard/actions.ts](src/app/(app)/dashboard/actions.ts)); `@@unique([profileId, versionNumber])`, prior versions never mutated |
| **Change summary** (diff since last version) | ✅ | [version.ts](src/lib/version.ts) `diffVersions` + [risk-events.ts](src/lib/risk-events.ts) `buildChangeSummary`; shown on research profile + dashboard |
| **Risk events** (persisted, dated, severity) | ✅ | `RiskEvent` rows generated on publish ([risk-events.ts](src/lib/risk-events.ts)): drawdown, worst-day, big-win dependency, loss/win, score-change, recovery, stale. Visible cards on research profile |
| **Report archive** (by month, draft/approved/published) | ✅ | `APPROVED` state added; `/reports` is now a by-month archive with three-state badges + Approve step |
| **Redaction controls** (granular toggles) | ✅ | `hideBrokers` added (masks broker/account names; metrics untouched) alongside `hideAmounts`; toggles in `/settings` |
| **Follower / watchlist** (email capture + queue) | ✅ | `ProfileFollower` + follow form on research profile; `NotificationEvent` queued on publish (delivery stubbed) |
| **Statement / tax-return verification** (P2) | 🟡 | Statement upload → Proof L3; tax return / official tax record upload → Proof L4 via [proof.ts](src/lib/proof.ts) / Evidence. Statement reconciliation placeholder remains |
| **Research Score v2** (reweight + update-reliability factor) | ✅ | [trust.ts](src/lib/trust.ts) composite now proof 25 / risk 25 / **update reliability 20** / consistency 15 / profit 10 / discipline 5; reliability derived from freshness |

**Net:** MVP2 P0–P1 are built. The only remaining brief item is P2 statement reconciliation (the
upload half is already done at Proof L3). Email *delivery* is intentionally stubbed (queue only).

---

## 4. Build plan (incremental, one slice at a time)

Each slice ships schema + a pure logic lib (+ colocated tests) + UI, matching existing conventions
(`*.test.ts` next to source; server actions; Prisma client from `src/generated/prisma`).

### MVP2.1 — Cadence + Freshness + Profile status  ✅ *done*
- **Schema:** `UpdateCadence` enum (`DAILY|WEEKLY|MONTHLY|MANUAL`); added `updateCadence` (default
  `MANUAL`) + `lastPublishedAt DateTime?` to `TraderProfile`. Migration
  `20260615190118_mvp2_cadence_freshness`.
- **Logic:** [src/lib/freshness.ts](src/lib/freshness.ts) (pure) — `getFreshnessStatus`,
  `nextExpectedUpdate`, `calculateUpdateReliability`, `describeFreshness`, `toCadence` + badge
  label/tone helpers. Thresholds from the brief (daily ≤48h / ≤7d; weekly ≤9d / ≤14d; monthly
  ≤40d / ≤60d; manual → `manual_only`; never-published → `never`). 12 colocated tests.
- **UI:** cadence selector in `/settings`; **Profile status card** on `/dashboard`
  ([profile-status.tsx](src/components/dashboard/profile-status.tsx)) — visibility · proof level ·
  cadence · freshness badge · last updated + next-due · Transparency Score · data coverage.
- **Bridge:** `lastPublishedAt` is set on CSV import-confirm so freshness is live now; MVP2.2 will
  repoint it to the version-publish action.
- **Verified:** `npm test` (48 pass), `npm run typecheck`, `npm run lint` all green.

### MVP2.2 — Upload history + file hash + immutable versions  ✅ *done*
- `ImportBatch` model (source, broker, filename, **sha-256 hash**, row count, period, starting/
  ending equity, net P&L, status); written by [import.ts](src/lib/ingest/import.ts).
- `ProfileVersion` model (immutable snapshot of metrics + scores + freshness at publish time);
  a **publish** action creates a new version and never mutates prior ones.
- UI: upload-history table + publish-preview (old vs new) in `/settings` (or a new dashboard tab).

### MVP2.3 — Change summary + persisted risk events  ✅ done
- On publish, diff new vs previous `ProfileVersion` → `RiskEvent` rows (drawdown, worst-day,
  big-win dependency, loss/win ratio, **stale-profile**, **score-change**, recovery) with
  severity + plain-English description + `isClientVisible`.
- AI layer writes the human-readable **change summary** stored on the version.
- Public profile renders client-visible risk-event cards + "since last update."

### MVP2.4 — Report archive  ✅ done
- Add `APPROVED` to report status; `month`/`year` for archive grouping.
- `/reports` gains a by-month archive (draft/approved/published cards) + chronological order.

### MVP2.5 — Granular redaction + follower capture  ✅ done
- Replace single `hideAmounts` with per-field redaction toggles (metrics never change — only
  display fields hide), with a clear "what's hidden" disclosure on the public profile.
- `ProfileFollower` + `NotificationEvent` (queue only; email delivery stubbed). Follow form with
  explicit no-advice language.

### Research Score v2 - done
- Once freshness + update-reliability data exist, reweight to: proof 25 · risk control 25 ·
  update reliability 20 · consistency 15 · profit quality 10 · transparency 5.

---

## 5. Acceptance checks we're holding ourselves to (from the brief)

- Every public profile shows last-updated, data coverage, and freshness status.
- Trader can set cadence; profile reflects the expected schedule.
- Each upload persists a row with file hash + period; duplicate source files are rejected per account.
- Publishing creates a **new immutable** version (publishing twice ⇒ two versions, first preserved).
- Public profile shows a change summary since the prior version.
- Risk events (incl. stale-profile & score-change) are detected and stored.
- Redaction hides private fields **without altering performance metrics**.
- Reports archive by month with draft/approved/published states.
- Follower emails stored; risk/monthly update events queued.
- **No UI copy** says invest, copy, recommended, guaranteed, or expected return.

---

## 6. Setup notes for implementation

- Postgres runs in Docker: **`npm run db:up`** before any `db:migrate` (it is currently *not*
  running). After schema edits: `npm run db:migrate` then `npm run db:generate`.
- Tests: `npm test` (vitest). Typecheck: `npm run typecheck`.
- Prisma client is imported from `src/generated/prisma`, not `@prisma/client`.

---

_Last updated: 2026-06-16 · **MVP2.1–2.5 + Score v2 complete** (P0–P1). Remaining: P2 statement
reconciliation and real email delivery (queue + capture are in place). Verified: `npm test`
(62 pass) · `npm run typecheck` · `npm run lint` · `/p/demo` renders the living profile._
