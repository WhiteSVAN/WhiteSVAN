-- AddEnumValue
ALTER TYPE "EvidenceKind" ADD VALUE 'TAX_RETURN';

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_accountId_fileHash_key" ON "ImportBatch"("accountId", "fileHash");
