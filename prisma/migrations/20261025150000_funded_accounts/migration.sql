-- AlterTable
ALTER TABLE "EvaluationAccount" ADD COLUMN     "fromAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationAccount_fromAccountId_key" ON "EvaluationAccount"("fromAccountId");

-- AddForeignKey
ALTER TABLE "EvaluationAccount" ADD CONSTRAINT "EvaluationAccount_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "EvaluationAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
