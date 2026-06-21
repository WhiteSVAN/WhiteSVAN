# TrustSVAN — Backlog

Things to come back to. MVP (M1–M6) and the first round of trust features are done and on `main`.

## Next up (highest value)

- [x] **FIFO round-trip matcher.** Pairs buys ↔ sells (FIFO) to compute realized P&L per close —
      [src/lib/csv/fifo.ts](src/lib/csv/fifo.ts). Handles partial fills, shorts, multiple symbols, and
      fees; feeds the existing `ParsedTrade[]` → `importTrades()` path. Broker adapters in
      [src/lib/csv/brokers.ts](src/lib/csv/brokers.ts): **Fidelity Activity History** (P&L from net
      `Amount`) and **Webull Orders** (P&L from `Avg Price` × multiplier; Webull omits fees → $0).
      Surfaced via the **Broker / import format** dropdown on `/upload` (auto-detect still default).
      Still TODO: Robinhood/Schwab/tastytrade adapters (dropdown shows them as "coming soon").
- [ ] **Multi-account portal.** The dashboard already has an account selector; extend `/p/[slug]`
      (and reports/evidence) to support more than the primary account — a selector or per-account
      sections.

## Brokers / ingestion

- [x] **Fidelity Activity History** import via FIFO matcher (verified against a real YTD export).
- [ ] Verify the **E\*TRADE** realized gain/loss aliases against a real export (Fidelity gain/loss
      aliases still added-from-docs; confirm column names).
- [ ] Verify the **Webull Orders** column names against a real export — adapter targets the standard
      US format (`Name, Symbol, Side, Status, Filled, Total Qty, Price, Avg Price, …, Filled Time`)
      with tolerant aliases; option symbol/multiplier handling needs a real-file check.
- [ ] **IBKR Flex Web Service auto-pull** — token + query ID → server-side fetch; thin adapter that
      emits `ParsedTrade[]` (import core is already source-agnostic).
- [ ] **Manual daily P&L entry** — fallback form (plan §4) for users without a clean CSV.

## Trust & verification

- [x] **Tax-return verification (Proof Level 4).** Uploaded tax return / official tax record evidence
      raises a profile to L4.
- [ ] **Proof Level 5** — third-party / admin verification. Currently CSV = L2, uploaded statement =
      L3, uploaded tax return / official tax record = L4.
- [ ] **Score breakdown popover** — hover/tooltip on the Transparency Score showing the exact formula
      per sub-score (weights are already shown).
- [ ] **Redaction granularity** — today only `hideAmounts`; add hide symbols / sizes / timestamps if
      trade-level views are ever exposed on the portal.

## Product / UX

- [ ] Back `/network` rooms and signal board with persisted posts, room membership, and moderation
      tools. Current slice ships the authenticated professional-network surface and real public
      profile directory without fake connect actions.
- [ ] Render each published report's **own stored metrics snapshot** in its portal section.
- [ ] **Email / magic-link auth** (currently credentials only; Auth.js adapter models already exist).
- [ ] **OG image + richer metadata** for shared portal links.
- [ ] Consider **shadcn/ui** for component polish (currently Tailwind only).

## Hardening (pre-beta)

- [ ] Rate-limiting / abuse protection on the waitlist and public endpoints.
- [ ] Tests for the **AI provider layer** (mocked OpenAI/Anthropic responses + compliance gate).

## Housekeeping

- [ ] Delete the redundant `feat/foundation-and-auth` branch (local + remote) — `main` has everything.
- [ ] **Hosting/deploy** — intentionally deferred (local-only for now). Vercel + managed Postgres when
      ready for beta users.

## Known caveats (don't lose this context)

- Most **retail transaction CSVs lack realized P&L** → need the FIFO matcher above.
- The public portal currently shows the **primary account only**.
- The AI report generator needs an API key (`OPENAI_API_KEY` default, or `AI_PROVIDER=anthropic`).
- Demo: `npm run db:seed` → `/p/demo` (login `demo@trustsvan.app` / `demo1234`).
