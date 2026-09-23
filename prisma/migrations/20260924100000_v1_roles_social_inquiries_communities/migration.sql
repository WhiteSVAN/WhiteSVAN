-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TRADER', 'CLIENT');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('MARKET_VIEW', 'TRADE_THESIS', 'TRADE_REVIEW', 'RESEARCH', 'PERFORMANCE_UPDATE', 'EDUCATIONAL');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'IGNORED');

-- CreateEnum
CREATE TYPE "CommunityVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED');

-- AlterTable
ALTER TABLE "TraderProfile" ADD COLUMN     "acceptInquiries" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "capitalBand" TEXT,
ADD COLUMN     "credentials" TEXT,
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "hiddenSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "markets" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "region" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "registrationType" TEXT,
ADD COLUMN     "strategyTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "TradingAccount" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT,
ADD COLUMN     "role" "UserRole";

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organization" TEXT,
    "clientType" TEXT,
    "markets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strategyTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("userId","profileId")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("userId","profileId")
);

-- CreateTable
CREATE TABLE "ProfileView" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "viewerId" TEXT,
    "viewerKey" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "communityId" TEXT,
    "type" "PostType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "symbols" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fields" JSONB,
    "verifiedTradeId" TEXT,
    "versionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "PostFlag" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryMessage" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT,
    "visibility" "CommunityVisibility" NOT NULL DEFAULT 'PUBLIC',
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityInvite" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CommunityInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_userId_key" ON "ClientProfile"("userId");

-- CreateIndex
CREATE INDEX "Follow_profileId_idx" ON "Follow"("profileId");

-- CreateIndex
CREATE INDEX "ProfileView_profileId_day_idx" ON "ProfileView"("profileId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileView_profileId_viewerKey_day_key" ON "ProfileView"("profileId", "viewerKey", "day");

-- CreateIndex
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_communityId_createdAt_idx" ON "Post"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostFlag_postId_reporterId_key" ON "PostFlag"("postId", "reporterId");

-- CreateIndex
CREATE INDEX "Inquiry_profileId_status_idx" ON "Inquiry"("profileId", "status");

-- CreateIndex
CREATE INDEX "Inquiry_clientId_idx" ON "Inquiry"("clientId");

-- CreateIndex
CREATE INDEX "InquiryMessage_inquiryId_createdAt_idx" ON "InquiryMessage"("inquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotification_userId_readAt_idx" ON "AppNotification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE INDEX "CommunityMember_userId_idx" ON "CommunityMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvite_token_key" ON "CommunityInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TraderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TraderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TraderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_verifiedTradeId_fkey" FOREIGN KEY ("verifiedTradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProfileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFlag" ADD CONSTRAINT "PostFlag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFlag" ADD CONSTRAINT "PostFlag_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TraderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryMessage" ADD CONSTRAINT "InquiryMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryMessage" ADD CONSTRAINT "InquiryMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every pre-V1 user created a trader record, so they are traders.
UPDATE "User" SET "role" = 'TRADER' WHERE "role" IS NULL AND "id" IN (SELECT "userId" FROM "TraderProfile");

-- Backfill: carry the old openToWork signal into the new inquiry setting.
UPDATE "TraderProfile" SET "acceptInquiries" = true WHERE "openToWork" = true;
