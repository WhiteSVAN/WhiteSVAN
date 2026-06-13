# TrustSVAN — Backlog

Things to come back to. MVP (M1–M6) and the first round of trust features are done and on `main`.

## Next up (highest value)

- [ ] **FIFO round-trip matcher.** Pair buys ↔ sells (FIFO) to compute realized P&L per close. This
      is the real unlock for **Robinhood / Webull / Fidelity activity** exports, whose transaction
      CSVs have no per-row realized P&L. Output should feed the existing `ParsedTrade[]` →
      `importTrades()` path. Handle partial fills, shorts, multiple symbols, and fees.
- [ ] **Multi-account portal.** The dashboard already has an account selector; extend `/p/[slug]`
      (and reports/evidence) to support more than the primary account — a selector or per-account
      sections.

## Brokers / ingestion

- [ ] Verify the **Fidelity** and **E\*TRADE** realized gain/loss aliases against real exports
      (added from public docs; user to confirm column names).
- [ ] **IBKR Flex Web Service auto-pull** — token + query ID → server-side fetch; thin adapter that
      emits `ParsedTrade[]` (import core is already source-agnostic).
- [ ] **Manual daily P&L entry** — fallback form (plan §4) for users without a clean CSV.

## Trust & verification

- [ ] **Proof Levels 4–5** — read-only broker connection (L4) and third-party / admin verification
      (L5). Currently CSV = L2, uploaded statement = L3.
- [ ] **Score breakdown popover** — hover/tooltip on the Transparency Score showing the exact formula
      per sub-score (weights are already shown).
- [ ] **Redaction granularity** — today only `hideAmounts`; add hide symbols / sizes / timestamps if
      trade-level views are ever exposed on the portal.

## Product / UX

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
