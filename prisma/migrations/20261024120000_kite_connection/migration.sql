-- CreateTable
CREATE TABLE "KiteConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sealed" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KiteConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KiteConnection_userId_idx" ON "KiteConnection"("userId");

-- AddForeignKey
ALTER TABLE "KiteConnection" ADD CONSTRAINT "KiteConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
