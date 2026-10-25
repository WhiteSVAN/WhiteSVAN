# Optional Temporal Cloud setup

WhiteSVAN does not currently need Temporal to serve pages, take orders or run its trading engine.
This setup is optional groundwork for durable background processes such as reconciliation,
KYC follow-ups and payout approvals. No business flow starts a Temporal workflow yet.

The existing payment webhook and database transactions continue to provision accounts.
The initial workflow, `whitesvanSmoke`, only runs a worker readiness Activity and returns a timestamp.
It sends no email and does not access trading or payment data.

## Cloud configuration

The supplied namespace is `quickstart-svan.fdx0h`, with endpoint
`quickstart-svan.fdx0h.tmprl.cloud:7233` and task queue `whitesvan`.
These settings are in the local, Git-ignored `.env.temporal`. The API-key secret is blank.
Replace the key shown in chat before using Cloud, then save the replacement secret locally:

```dotenv
TEMPORAL_MODE="cloud"
TEMPORAL_ADDRESS="quickstart-svan.fdx0h.tmprl.cloud:7233"
TEMPORAL_NAMESPACE="quickstart-svan.fdx0h"
TEMPORAL_API_KEY="<replacement API-key secret, not the key ID>"
TEMPORAL_TASK_QUEUE="whitesvan"
```

CLI commands load `.env.temporal`, then `.env`, without overriding host environment variables.
Next.js loads its normal `.env` files; when adding a server-side caller later, supply the same
variables in `.env.local` or the web host's environment settings. Never prefix these with `NEXT_PUBLIC_`.
Cloud mode always enables TLS and sends namespace routing metadata. It fails clearly when
credentials are missing. No Cloud connection is made during a normal Next.js build.

Use Node.js 22 or 24. All Temporal SDK packages are pinned to the same version in `package-lock.json`.

```sh
npm run temporal:check   # verifies authentication and namespace access; needs no running worker
npm run temporal:worker  # long-running worker; leave this terminal open
```

In a second terminal, run `npm run temporal:smoke`. This starts a fresh workflow and waits up to
one minute for the worker and Activity to finish. Its execution is visible in Temporal Cloud.
It creates a real workflow execution, so only run it when ready to use the Cloud namespace.

## Local verification without Cloud

```sh
npm run temporal:test
```

This builds the production worker and workflow bundle, starts an isolated local Temporal service,
executes the smoke workflow through the Node client, verifies its result, then shuts everything down.
It ignores Cloud credentials. On first run, the SDK downloads the development-server executable
into `artifacts/temporal-test-server` (Git-ignored). Alternatively, point
`TEMPORAL_TEST_SERVER_PATH` at an installed Temporal CLI executable.

For manual local development, install the [Temporal CLI](https://docs.temporal.io/cli) and run
`temporal server start-dev`. Change `.env.temporal` to:

```dotenv
TEMPORAL_MODE="local"
TEMPORAL_ADDRESS="localhost:7233"
TEMPORAL_NAMESPACE="default"
TEMPORAL_API_KEY=""
TEMPORAL_TASK_QUEUE="whitesvan"
```

Then run `npm run temporal:worker` and, in another terminal, `npm run temporal:smoke`.
The local UI is at `http://localhost:8233`. Cloud credentials are rejected in plaintext local mode.

## Worker deployment when needed

Temporal Cloud hosts orchestration and history. Your worker runs on your infrastructure.
Keep the Next.js website on Vercel and deploy the worker as a persistent process or background
container on a suitable host. A normal Vercel request handler is not a persistent worker host.
No worker has been deployed by this setup.

```sh
npm ci
npm run temporal:build
NODE_ENV=production npm run temporal:start
```

On Windows, set `NODE_ENV=production` through the host environment or PowerShell's `$env:NODE_ENV`.
The build compiles the Node entry point and prebundles workflow code. Production mode requires that
bundle. The SDK handles SIGINT/SIGTERM and allows 30 seconds for in-flight work to drain.
Set the host's termination grace period longer than 30 seconds.

A separate container definition is provided:

```sh
docker build -f deploy/temporal/Dockerfile -t whitesvan-temporal .
docker run --init --stop-timeout 40 --env-file .env.temporal whitesvan-temporal
```

The Dockerfile-specific ignore file restricts build input to worker sources, scripts and dependency
metadata; `.env` files are excluded. Secrets belong in the runtime host's environment settings.
The container runs as the unprivileged `node` user and does not need a database for the smoke workflow.

## Using it in future server code

`src/lib/temporal/client.ts` exports `getTemporalClient()` for a reused Node.js server connection.
It retries connection creation after a failed attempt. Import workflow types with `import type`,
and start workflows by their registered name; never import workflow runtime code into Next.js.
Use authenticated Node.js handlers and return after starting long-running work.

Before moving a business process here, design stable workflow IDs, idempotent Activities and a
reliable handoff from database transactions (for example an outbox). Temporal alone does not make
external payments or emails execute exactly once. Keep price ticks, order matching and financial
calculations in the trading engine. Database/network calls belong in Activities; workflow code
must remain deterministic. Plan workflow versioning before changing code with active executions.

Official references: [TypeScript quickstart](https://docs.temporal.io/develop/typescript/set-up-your-local-typescript),
[Cloud API keys](https://docs.temporal.io/cloud/api-keys),
[worker deployment](https://docs.temporal.io/production-deployment).
