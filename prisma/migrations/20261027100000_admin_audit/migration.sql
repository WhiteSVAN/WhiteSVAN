-- The admin portal: an admin flag on users, and the trade and activity audit (every fill, order,
-- breach and pass on demo and funded accounts), with what the desks already hold copied in.

-- CreateEnum
CREATE TYPE "AccountEventKind" AS ENUM ('ORDER_PLACED', 'ORDER_MODIFIED', 'ORDER_CANCELLED', 'ORDER_REJECTED', 'ORDER_REFUSED', 'BREACH', 'PASSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AccountFill" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fillId" TEXT NOT NULL,
    "orderId" TEXT,
    "reason" TEXT NOT NULL,
    "token" INTEGER NOT NULL,
    "tradingSymbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "realised" INTEGER NOT NULL,
    "charges" JSONB NOT NULL,
    "chargesTotal" INTEGER NOT NULL,
    "chargesSchedule" TEXT NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "tradeDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountFill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "AccountEventKind" NOT NULL,
    "orderId" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountFill_userId_at_idx" ON "AccountFill"("userId", "at");

-- CreateIndex
CREATE INDEX "AccountFill_at_idx" ON "AccountFill"("at");

-- CreateIndex
CREATE UNIQUE INDEX "AccountFill_accountId_fillId_key" ON "AccountFill"("accountId", "fillId");

-- CreateIndex
CREATE INDEX "AccountEvent_userId_at_idx" ON "AccountEvent"("userId", "at");

-- CreateIndex
CREATE INDEX "AccountEvent_at_idx" ON "AccountEvent"("at");

-- CreateIndex
CREATE INDEX "AccountEvent_kind_at_idx" ON "AccountEvent"("kind", "at");

-- CreateIndex
CREATE UNIQUE INDEX "AccountEvent_accountId_key_key" ON "AccountEvent"("accountId", "key");

-- AddForeignKey
ALTER TABLE "AccountFill" ADD CONSTRAINT "AccountFill_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EvaluationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountFill" ADD CONSTRAINT "AccountFill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEvent" ADD CONSTRAINT "AccountEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EvaluationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEvent" ADD CONSTRAINT "AccountEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from the desks. Each desk keeps its latest 200 fills and orders, which covers every account
-- so far; from now on the store writes each one as it happens (src/lib/accounts/audit.ts), with the
-- same keys, so nothing is recorded twice. Order changes made before today aren't on the desks.
-- Desk times are epoch milliseconds (UTC). IST is UTC+05:30 all year, so trading dates add a fixed
-- offset rather than relying on the server's time zone names.

-- Fills.
INSERT INTO "AccountFill" ("id", "accountId", "userId", "fillId", "orderId", "reason", "token", "tradingSymbol", "side", "quantity", "price", "realised", "charges", "chargesTotal", "chargesSchedule", "balanceAfter", "at", "tradeDate")
SELECT 'bf' || md5(a."id" || ':' || (f->>'id')),
       a."id", a."userId", f->>'id', f->>'orderId', f->>'reason',
       (f->>'token')::integer, f->>'tradingSymbol', f->>'side',
       (f->>'quantity')::integer, (f->>'price')::integer, (f->>'realised')::integer,
       f->'charges', (f->'charges'->>'total')::integer, COALESCE(f->>'chargesSchedule', ''),
       (f->>'balanceAfter')::integer,
       TIMESTAMP 'epoch' + (f->>'at')::double precision * INTERVAL '1 millisecond',
       (TIMESTAMP 'epoch' + (f->>'at')::double precision * INTERVAL '1 millisecond' + INTERVAL '5 hours 30 minutes')::date
FROM "EvaluationAccount" a
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a."desk"->'fills', '[]'::jsonb)) AS f
ON CONFLICT ("accountId", "fillId") DO NOTHING;

-- Orders: placed (or rejected) when they were placed.
INSERT INTO "AccountEvent" ("id", "accountId", "userId", "key", "kind", "orderId", "at", "detail")
SELECT 'bf' || md5(a."id" || ':order:' || (o->>'id') || ':' || CASE WHEN o->>'status' = 'REJECTED' THEN 'rejected' ELSE 'placed' END),
       a."id", a."userId",
       'order:' || (o->>'id') || ':' || CASE WHEN o->>'status' = 'REJECTED' THEN 'rejected' ELSE 'placed' END,
       (CASE WHEN o->>'status' = 'REJECTED' THEN 'ORDER_REJECTED' ELSE 'ORDER_PLACED' END)::"AccountEventKind",
       o->>'id',
       TIMESTAMP 'epoch' + (o->>'placedAt')::double precision * INTERVAL '1 millisecond',
       jsonb_build_object(
         'tradingSymbol', o->'tradingSymbol', 'token', o->'token', 'side', o->'side', 'type', o->'type',
         'lots', o->'lots', 'quantity', o->'quantity', 'limitPrice', o->'limitPrice', 'triggerPrice', o->'triggerPrice',
         'exit', CASE WHEN o->>'id' LIKE '%-SL' THEN 'stop' WHEN o->>'id' LIKE '%-TP' THEN 'target' END,
         'reason', CASE WHEN o->>'status' = 'REJECTED' THEN o->'reason' END,
         'backfilled', true)
FROM "EvaluationAccount" a
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a."desk"->'orderBook', '[]'::jsonb)) AS o
ON CONFLICT ("accountId", "key") DO NOTHING;

-- Orders: cancelled when they were cancelled.
INSERT INTO "AccountEvent" ("id", "accountId", "userId", "key", "kind", "orderId", "at", "detail")
SELECT 'bf' || md5(a."id" || ':order:' || (o->>'id') || ':cancelled'),
       a."id", a."userId", 'order:' || (o->>'id') || ':cancelled', 'ORDER_CANCELLED', o->>'id',
       TIMESTAMP 'epoch' + (o->>'updatedAt')::double precision * INTERVAL '1 millisecond',
       jsonb_build_object(
         'tradingSymbol', o->'tradingSymbol', 'side', o->'side', 'type', o->'type', 'lots', o->'lots',
         'quantity', o->'quantity', 'filled', o->'filled', 'reason', o->'reason', 'backfilled', true)
FROM "EvaluationAccount" a
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a."desk"->'orderBook', '[]'::jsonb)) AS o
WHERE o->>'status' = 'CANCELLED'
ON CONFLICT ("accountId", "key") DO NOTHING;

-- Breaches: the engine's breach report.
INSERT INTO "AccountEvent" ("id", "accountId", "userId", "key", "kind", "orderId", "at", "detail")
SELECT 'bf' || md5(a."id" || ':breach'), a."id", a."userId", 'breach', 'BREACH', NULL,
       TIMESTAMP 'epoch' + (a."desk"->'state'->'breach'->>'at')::double precision * INTERVAL '1 millisecond',
       (a."desk"->'state'->'breach') || '{"backfilled": true}'::jsonb
FROM "EvaluationAccount" a
WHERE jsonb_typeof(a."desk"->'state'->'breach') = 'object'
ON CONFLICT ("accountId", "key") DO NOTHING;

-- Passes, at the close of the day they passed: 15:30 IST is 10:00 UTC.
INSERT INTO "AccountEvent" ("id", "accountId", "userId", "key", "kind", "orderId", "at", "detail")
SELECT 'bf' || md5(a."id" || ':passed'), a."id", a."userId", 'passed', 'PASSED', NULL,
       (a."desk"->'state'->>'passedOn')::date + TIME '10:00',
       jsonb_build_object(
         'date', a."desk"->'state'->'passedOn',
         'balance', a."desk"->'state'->'balance',
         'profit', (a."desk"->'state'->>'balance')::bigint - (a."desk"->'state'->'rules'->>'startingBalance')::bigint,
         'tradingDays', jsonb_array_length(COALESCE(a."desk"->'state'->'days', '[]'::jsonb)),
         'backfilled', true)
FROM "EvaluationAccount" a
WHERE a."desk"->'state'->>'status' = 'PASSED' AND a."desk"->'state'->>'passedOn' IS NOT NULL
ON CONFLICT ("accountId", "key") DO NOTHING;
