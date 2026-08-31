import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import type { NoteFormValues } from "@/lib/validations/note";
import type { Prisma, Note } from "@prisma/client";

const PAGE_SIZE = 12;

export interface ListNotesParams {
  q?: string;
  tag?: string;
  pinnedOnly?: boolean;
  customerId?: string;
  orderId?: string;
  page?: number;
}

export async function listNotes(params: ListNotesParams) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const where: Prisma.NoteWhereInput = {
      ...(params.pinnedOnly ? { pinned: true } : {}),
      ...(params.tag ? { tags: { contains: params.tag } } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.orderId ? { orderId: params.orderId } : {}),
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q } },
              { content: { contains: params.q } },
              { tags: { contains: params.q } },
            ],
          }
        : {}),
    };

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          customer: { select: { id: true, name: true } },
          order: { select: { id: true, number: true } },
        },
      }),
      prisma.note.count({ where }),
    ]);

    return { notes, total, page, pageSize: PAGE_SIZE };
  } catch (err) {
    console.error("Error in listNotes:", err);
    return { notes: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
}

export async function getNoteDetail(id: string) {
  try {
    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        order: { select: { id: true, number: true } },
      },
    });
    return note;
  } catch (err) {
    console.error("Error in getNoteDetail:", err);
    return null;
  }
}

export function noteToFormValues(note: Note): NoteFormValues {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags ?? "",
    pinned: note.pinned ?? false,
    customerId: note.customerId ?? "",
    orderId: note.orderId ?? "",
    taskId: note.taskId ?? "",
  };
}

export async function createNote(data: NoteFormValues) {
  const note = await prisma.note.create({
    data: {
      title: data.title,
      content: data.content,
      tags: data.tags || null,
      pinned: data.pinned,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      taskId: data.taskId || null,
    },
  });

  await logActivity({
    type: "note.created",
    message: `Note created: "${note.title}"`,
    entityType: "note",
    entityId: note.id,
    customerId: note.customerId ?? undefined,
    orderId: note.orderId ?? undefined,
  });

  return note;
}

export async function updateNote(id: string, data: NoteFormValues) {
  const note = await prisma.note.update({
    where: { id },
    data: {
      title: data.title,
      content: data.content,
      tags: data.tags || null,
      pinned: data.pinned,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      taskId: data.taskId || null,
    },
  });

  await logActivity({
    type: "note.updated",
    message: `Note updated: "${note.title}"`,
    entityType: "note",
    entityId: note.id,
    customerId: note.customerId ?? undefined,
    orderId: note.orderId ?? undefined,
  });

  return note;
}

export async function togglePinNote(id: string) {
  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) throw new Error("Note not found");

  return prisma.note.update({
    where: { id },
    data: { pinned: !existing.pinned },
  });
}

export async function deleteNote(id: string) {
  return prisma.note.delete({ where: { id } });
}

