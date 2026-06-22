-- AlterTable
ALTER TABLE "TraderProfile" ADD COLUMN     "openToWork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "services" TEXT,
ADD COLUMN     "contactUrl" TEXT;
