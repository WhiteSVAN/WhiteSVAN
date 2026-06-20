/**
 * Proof Level derivation. CSV-imported data is Level 2; an uploaded broker
 * STATEMENT raises it to Level 3. Levels 4–5 (broker connection, third-party
 * verification) are future work.
 */
import { prisma } from "@/lib/db";
import type { ProofLevel } from "@/lib/trust";

export async function accountProofLevel(accountId: string, hasData: boolean): Promise<ProofLevel> {
  if (!hasData) return 1;
  const account = await prisma.tradingAccount.findUnique({
    where: { id: accountId },
    select: { userId: true },
  });
  if (!account) return 1;

  const taxReturns = await prisma.evidence.count({
    where: {
      userId: account.userId,
      kind: "TAX_RETURN",
      OR: [{ accountId }, { accountId: null }],
    },
  });
  if (taxReturns > 0) return 4;

  const statements = await prisma.evidence.count({
    where: { accountId, kind: "STATEMENT" },
  });
  return statements > 0 ? 3 : 2;
}
