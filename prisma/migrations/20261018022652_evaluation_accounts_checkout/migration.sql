-- CreateEnum
CREATE TYPE "EvaluationPhase" AS ENUM ('EVALUATION', 'FUNDED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('ACTIVE', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "EvaluationAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "phase" "EvaluationPhase" NOT NULL DEFAULT 'EVALUATION',
    "status" "EvaluationStatus" NOT NULL DEFAULT 'ACTIVE',
    "desk" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "accountId" TEXT,
    "billingName" TEXT NOT NULL,
    "billingEmail" TEXT NOT NULL,
    "billingPhone" TEXT,
    "billingState" TEXT NOT NULL,
    "acceptedTermsAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationAccount_userId_idx" ON "EvaluationAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutOrder_providerOrderId_key" ON "CheckoutOrder"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutOrder_providerPaymentId_key" ON "CheckoutOrder"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutOrder_accountId_key" ON "CheckoutOrder"("accountId");

-- CreateIndex
CREATE INDEX "CheckoutOrder_userId_idx" ON "CheckoutOrder"("userId");

-- AddForeignKey
ALTER TABLE "EvaluationAccount" ADD CONSTRAINT "EvaluationAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutOrder" ADD CONSTRAINT "CheckoutOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutOrder" ADD CONSTRAINT "CheckoutOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EvaluationAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
