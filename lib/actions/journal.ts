"use server";

import { revalidatePath } from "next/cache";
import * as journalService from "@/lib/services/accounting/journal";
import { requirePermission } from "@/lib/auth/session";
import { friendlyError, flattenZodError, type FormActionResult } from "@/lib/actions/utils";
import { z } from "zod";

const journalLineSchema = z.object({
  accountId: z.string().nullable().optional(),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
  description: z.string().optional(),
});

const createJournalSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required").max(500),
  reference: z.string().max(100).optional(),
  lines: z.array(journalLineSchema).min(2, "At least 2 lines are required"),
});

export async function createJournalEntryAction(values: any): Promise<FormActionResult> {
  const user = await requirePermission("journal:create");
  const parsed = createJournalSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: flattenZodError(parsed.error),
    };
  }

  try {
    const formattedLines = parsed.data.lines.map((line) => {
      const isDebit = line.debit > 0;
      return {
        debitAccountId: isDebit ? line.accountId : null,
        creditAccountId: !isDebit ? line.accountId : null,
        debitPaise: Math.round(line.debit * 100),
        creditPaise: Math.round(line.credit * 100),
        description: line.description,
      };
    });

    const entry = await journalService.createJournalEntry({
      date: parsed.data.date,
      description: parsed.data.description,
      reference: parsed.data.reference,
      sourceType: "manual",
      createdById: user.id,
      lines: formattedLines,
      autoPost: true, // Auto post manual journal entries
    });

    revalidatePath("/accounting/journal");
    revalidatePath("/accounting/ledger");
    revalidatePath("/finance");
    return { success: true, id: entry.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}

export async function reverseJournalEntryAction(id: string, reason: string): Promise<FormActionResult> {
  const user = await requirePermission("journal:create");
  if (!reason.trim()) {
    return { success: false, message: "Reversal reason is required." };
  }

  try {
    const reversal = await journalService.reverseJournalEntry(id, {
      description: reason,
      createdById: user.id,
    });
    revalidatePath("/accounting/journal");
    revalidatePath(`/accounting/journal/${id}`);
    revalidatePath("/accounting/ledger");
    revalidatePath("/finance");
    return { success: true, id: reversal.id };
  } catch (err) {
    return { success: false, message: friendlyError(err) };
  }
}
