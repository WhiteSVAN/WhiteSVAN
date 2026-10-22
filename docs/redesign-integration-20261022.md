# WhiteSVAN redesign and backend integration

Implemented against `WhiteSVAN/WhiteSVAN` main revision `fed14b1`, preserving its Next.js application, Prisma/PostgreSQL schema, Auth.js authentication, published-profile snapshots, privacy controls, and trading restrictions. These changes have not been pushed or deployed to production.

## Delivered changes

The homepage now has an interactive account preview for all four evaluation plans, with sample-equity and rule views, plan-specific limits, target progress, and links to the existing evaluation detail routes. Figures derive from `src/lib/prop-firm.ts`; sample history is explicitly illustrative, not a customer record, live price feed, or forecast.

Follow and private-watchlist controls now handle the server's error responses and network failures. They roll back optimistic changes, announce errors accessibly, show pending feedback, and provide sign-in recovery when a session expires. Existing server-side authorization and Prisma persistence remain authoritative.

Launch-list emails are trimmed, normalized, bounded, and validated before the existing idempotent database upsert. New tests cover invalid inputs, rate limits, normalization, and database failure messages.

New real-PostgreSQL integration tests verify that the directory reads published snapshots, excludes private profiles, respects hidden performance and credentials, and exposes saved/followed state only to its viewer. The schema and migration SQL were not changed.

Next.js was updated to 16.4.2, Auth.js to 5.0.0-beta.32, and the Prisma packages to 7.10.1. A compatible `source-map-js` override addresses its high-severity advisory. Development resources are restricted to localhost testing and an explicitly configured preview hostname via `NEXT_DEV_ALLOWED_ORIGIN`; no wildcard or production authorization relaxation was introduced.

## Validation

- A clean `npm ci` succeeded for the portable source and lockfile.
- All 391 tests across 41 files passed, including PostgreSQL import and directory integration tests.
- Type checking and ESLint passed.
- `npx next build` succeeded without running production migrations.
- Nine browser check groups passed: interactive plan/rule values and links; layouts at 320, 375, 768 and 1440 pixels; help search; checkout gating; credentials login; watchlist persistence after reload; viewer-specific watchlist filtering; expired-session recovery; and absence of uncaught browser errors.
- All 11 existing migrations applied successfully to a disposable local PostgreSQL database. Fixtures and seeded profiles were created only there, not in production.
- The portable production dependency audit reported no high or critical findings. One moderate `baseline-browser-mapping` advisory remains. Development dependencies still have audit findings; no claim of complete security certification is made.

## Production rollout

The live `white-svan.vercel.app` deployment is unchanged. Vercel account access requires reauthorization. Repository pushes may trigger production automation, so no remote branch, pull request, merge, or deployment was created by this task.

The source package contains the existing application plus these changes, without database credentials, generated clients, dependency directories, build output, or uploaded evidence. Use the supplied incremental patch against revision `fed14b1` when reviewing the changes instead of overwriting a newer checkout.

After Vercel access is restored, inspect the current production deployment and its linked repository. Review the diff against current main, use the existing PostgreSQL and Auth.js environment settings, and verify authentication, published-record privacy, imports, and the launch-list flow before releasing. No new migration is required by this change set; existing migrations must already be applied in the target database.

The managed preview is temporary and uses a disposable seeded local database. It is not a production database connection and should not be published as a replacement for the existing Vercel app.

Payment processing, GST invoicing/refunds, KYC, actual payout processing, a licensed shared market-data feed, and the always-on trading engine remain separate unimplemented launch requirements in the repository. Public checkout and restricted Kite data access were not unlocked. No real payment, payout, order, broker connection, or financial-record submission was performed.
