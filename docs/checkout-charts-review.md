# Razorpay checkout and restored charts

Continued Claude's interrupted checkout/chart work and completed local verification on 25 October 2026.

## Chart restoration

PR #48 (`f5556aa`, merged as `7f472eb`) removed index/futures selection. The preceding version,
`2175cce`, is the reference for the restored index selection. `price-chart.tsx` is unchanged across
those versions; the existing candle renderer was reused.

The trading screen opens on the index chart. Clicking an option price opens that option's chart,
including volume, open interest and depth. The option chain and order ticket sit beside the chart
on desktop and below it on phones. Buy/Sell keeps an index chart selected. Futures trading stays
disabled under the existing options-only policy.

## Checkout

Without both Razorpay keys, public checkout opens an evaluation at ₹0 and explicitly records no
payment taken. Staff sign-ins keep uncharged test checkout. With keys, the server creates a Razorpay
order and Checkout.js opens against that order.

The browser callback now verifies the signature and fetches the payment from Razorpay. The payment
ID, stored order, amount and INR currency must match, and both the status and capture flag must
confirm capture before an account opens. Authorized payments or verification API failures stay
pending for confirmation. Closing the payment window asks traders to check My accounts before
retrying, without asserting that no charge occurred.

Signed `payment.captured`/`order.paid` webhooks can open an account when the browser does not return.
Database transactions and order state prevent duplicate account provisioning when callbacks or
webhooks race or repeat.

## Verification

- Production Next.js build passed, without running the deploy/migration build script.
- All 488 automated tests passed against the disposable local `whitesvan_preview` database,
  including the database integration suites.
- ESLint and TypeScript checks passed. Generated files in `artifacts/` are excluded from lint.
- Free-mode browser checks: 28/28 passed, including chart rendering, option depth, market buy/exit,
  account views and 375px layouts.
- Razorpay browser checks: 17/17 passed, including authorized-before-capture, successful capture,
  payment-window dismissal, forged signatures, and concurrent/repeated signed webhooks.

Browser runs used synthetic market data, dummy gateway credentials, an intercepted Checkout.js and
local Kite/Razorpay stand-ins. No live charge or external merchant configuration was tested.
Local results and screenshots are under the Git-ignored directory
`artifacts/claude-continuation/free-final` and `artifacts/claude-continuation/razorpay-final`.

## Activation

Follow the Razorpay section of `README.md` and `.env.example`: supply the merchant keys, configure
automatic capture, and register `/api/razorpay/webhook` with its own secret and captured/paid events.
Use Razorpay test-mode keys to validate the merchant integration before enabling live-mode keys.
The funded payout page remains a quote/prerequisite display; payout processing and KYC are separate
unfinished integrations. Deployment is tracked separately from these local verification results.

Payment API reference: [fetch a payment](https://razorpay.com/docs/api/payments/fetch-with-id/).
