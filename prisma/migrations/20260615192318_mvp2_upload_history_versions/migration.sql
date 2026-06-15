-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('CSV', 'MANUAL', 'STATEMENT', 'BROKER_API');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL DEFAULT 'CSV',
    "broker" TEXT,
    "originalFilename" TEXT,
    "fileHash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "netPnl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileVersion" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "metrics" JSONB NOT NULL,
    "netPnl" DECIMAL(18,2) NOT NULL,
    "returnPct" DOUBLE PRECISION,
    "transparencyScore" INTEGER NOT NULL,
    "proofLevel" INTEGER NOT NULL,
    "freshnessStatus" TEXT NOT NULL,
    "changeSummary" TEXT,
    "sourceBatchId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_accountId_idx" ON "ImportBatch"("accountId");

-- CreateIndex
CREATE INDEX "ProfileVersion_profileId_idx" ON "ProfileVersion"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileVersion_profileId_versionNumber_key" ON "ProfileVersion"("profileId", "versionNumber");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileVersion" ADD CONSTRAINT "ProfileVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TraderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileVersion" ADD CONSTRAINT "ProfileVersion_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
