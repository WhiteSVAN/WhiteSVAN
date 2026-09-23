import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { readEvidenceFile } from "@/lib/evidence";

/** Serve sensitive evidence files to their owner only. Public pages expose metadata, never bytes. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const evidence = await prisma.evidence.findUnique({
    where: { id },
    select: { id: true, userId: true, mime: true, originalName: true },
  });
  if (!evidence) return new Response("Not found", { status: 404 });

  const session = await auth();
  const owner = session?.user?.id === evidence.userId;
  if (!owner) {
    return new Response("Forbidden", { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await readEvidenceFile(id);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const safeName = evidence.originalName.replace(/["\r\n]/g, "");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": evidence.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
