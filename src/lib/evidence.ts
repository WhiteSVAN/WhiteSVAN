/**
 * Evidence file storage — local disk under `storage/evidence/` (git-ignored).
 * Files are named by their Evidence row id; the mime type lives in the DB.
 */
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";

const STORAGE_DIR = path.join(process.cwd(), "storage", "evidence");

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);

export async function saveEvidenceFile(id: string, bytes: Buffer): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(path.join(STORAGE_DIR, id), bytes);
}

export async function readEvidenceFile(id: string): Promise<Buffer> {
  return readFile(path.join(STORAGE_DIR, id));
}

export async function deleteEvidenceFile(id: string): Promise<void> {
  await unlink(path.join(STORAGE_DIR, id)).catch(() => {});
}
