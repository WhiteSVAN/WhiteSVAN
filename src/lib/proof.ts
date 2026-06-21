/**
 * Proof Level derivation. CSV-imported data is Level 2; an uploaded broker
 * STATEMENT raises it to Level 3, and a TAX_RETURN raises it to Level 4.
 */
import { prisma } from "@/lib/db";
import type { ProofLevel } from "@/lib/trust";

type CountRow = { count: number };

export async function accountProofLevel(accountId: string, hasData: boolean): Promise<ProofLevel> {
  if (!hasData) return 1;
  const account = await prisma.tradingAccount.findUnique({
    where: { id: accountId },
    select: { userId: true },
  });
  if (!account) return 1;

  const [taxReturns] = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::integer AS count
    FROM "Evidence"
    WHERE "userId" = ${account.userId}
      AND "kind" = 'TAX_RETURN'::"EvidenceKind"
      AND ("accountId" = ${accountId} OR "accountId" IS NULL)
  `;
  if (taxReturns.count > 0) return 4;

  const [statements] = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::integer AS count
    FROM "Evidence"
    WHERE "accountId" = ${accountId}
      AND "kind" = 'STATEMENT'::"EvidenceKind"
  `;
  return statements.count > 0 ? 3 : 2;
}
