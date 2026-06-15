-- CreateEnum
CREATE TYPE "UpdateCadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL');

-- AlterTable
ALTER TABLE "TraderProfile" ADD COLUMN     "lastPublishedAt" TIMESTAMP(3),
ADD COLUMN     "updateCadence" "UpdateCadence" NOT NULL DEFAULT 'MANUAL';
