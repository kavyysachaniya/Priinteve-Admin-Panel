"use server";

import { revalidatePath } from "next/cache";
import * as noteService from "@/lib/services/notes";
import { noteFormSchema, type NoteFormValues } from "@/lib/validations/note";
import { flattenZodError, friendlyError, type FormActionResult } from "@/lib/actions/utils";
import { requirePermission } from "@/lib/auth/session";

export async function createNoteAction(values: NoteFormValues): Promise<FormActionResult> {
  await requirePermission("notes:create");
  const parsed = noteFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    const note = await noteService.createNote(parsed.data);
    revalidatePath("/notes");
    revalidatePath("/planner");
    return { success: true, id: note.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function updateNoteAction(id: string, values: NoteFormValues): Promise<FormActionResult> {
  await requirePermission("notes:edit");
  const parsed = noteFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, message: "Please fix the highlighted fields.", fieldErrors: flattenZodError(parsed.error) };
  }
  try {
    await noteService.updateNote(id, parsed.data);
    revalidatePath("/notes");
    revalidatePath(`/notes/${id}`);
    revalidatePath("/planner");
    return { success: true, id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function togglePinNoteAction(id: string) {
  await requirePermission("notes:edit");
  try {
    const note = await noteService.togglePinNote(id);
    revalidatePath("/notes");
    revalidatePath(`/notes/${id}`);
    revalidatePath("/planner");
    return { success: true, message: note.pinned ? "Note pinned" : "Note unpinned" };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function deleteNoteAction(id: string) {
  await requirePermission("notes:delete");
  try {
    await noteService.deleteNote(id);
    revalidatePath("/notes");
    revalidatePath("/planner");
    return { success: true, message: "Note deleted" };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
