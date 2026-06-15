-- CreateEnum
CREATE TYPE "RiskEventType" AS ENUM ('DRAWDOWN', 'WORST_DAY', 'BIG_WIN_DEPENDENCY', 'LOSS_VS_WIN', 'STALE_PROFILE', 'SCORE_CHANGE', 'RECOVERY');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FollowerStatus" AS ENUM ('PENDING', 'ACTIVE', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "FollowFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'RISK_CHANGES_ONLY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WEEKLY_UPDATE', 'MONTHLY_REPORT', 'RISK_CHANGE', 'STALE_PROFILE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "TraderProfile" ADD COLUMN     "hideBrokers" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "versionId" TEXT,
    "type" "RiskEventType" NOT NULL,
    "severity" "RiskSeverity" NOT NULL DEFAULT 'INFO',
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metricBefore" DOUBLE PRECISION,
    "metricAfter" DOUBLE PRECISION,
    "isClientVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileFollower" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "FollowerStatus" NOT NULL DEFAULT 'ACTIVE',
    "frequency" "FollowFrequency" NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileFollower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "followerId" TEXT,
    "type" "NotificationType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskEvent_profileId_idx" ON "RiskEvent"("profileId");

-- CreateIndex
CREATE INDEX "ProfileFollower_profileId_idx" ON "ProfileFollower"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileFollower_profileId_email_key" ON "ProfileFollower"("profileId", "email");

-- CreateIndex
CREATE INDEX "NotificationEvent_profileId_idx" ON "NotificationEvent"("profileId");

-- AddForeignKey
ALTER TABLE "RiskEvent" ADD CONSTRAINT "RiskEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TraderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvent" ADD CONSTRAINT "RiskEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProfileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileFollower" ADD CONSTRAINT "ProfileFollower_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TraderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TraderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "ProfileFollower"("id") ON DELETE SET NULL ON UPDATE CASCADE;
