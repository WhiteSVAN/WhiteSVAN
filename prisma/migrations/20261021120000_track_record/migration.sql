-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "openPositions" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TradingAccount" ADD COLUMN     "trackPlanId" TEXT,
ADD COLUMN     "trackStart" DATE;
