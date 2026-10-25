"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { NOTE_MAX_LENGTH } from "@/lib/journal";

export type NoteResult = { saved: true } | { error: string };

/** Save the trader's note for one day, or delete it when the text is empty. */
export async function saveDayNote(date: string, text: string): Promise<NoteResult> {
  const user = await requireMember();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!day || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date) return { error: "That isn't a date." };
  const body = text.trim();
  if (body.length > NOTE_MAX_LENGTH) return { error: `Keep a note under ${NOTE_MAX_LENGTH.toLocaleString("en-IN")} characters.` };
  if (body) {
    await prisma.journalNote.upsert({ where: { userId_date: { userId: user.id, date: day } }, create: { userId: user.id, date: day, text: body }, update: { text: body } });
  } else {
    await prisma.journalNote.deleteMany({ where: { userId: user.id, date: day } });
  }
  revalidatePath("/journal");
  return { saved: true };
}
