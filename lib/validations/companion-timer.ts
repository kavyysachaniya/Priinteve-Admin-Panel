import { z } from "zod";

// Timer operations sent by the desktop app from its local journal (see lib/services/companion/timer.ts).

const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "Invalid id");
const opId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "Invalid operation id");
const isoDate = z
  .string()
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid timestamp");

const base = {
  opId,
  /** When the person clicked, in the server's time as the app best knew it. */
  occurredAt: isoDate,
};

export const companionTimerOpSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("START"),
    projectId: id,
    taskId: id.optional(),
    newTaskTitle: z.string().trim().min(2, "Task title is too short").max(200).optional(),
    description: z.string().trim().max(500).optional(),
  }),
  z.object({ ...base, type: z.literal("PAUSE"), entryId: id.optional() }),
  z.object({ ...base, type: z.literal("RESUME"), projectId: id }),
  z.object({
    ...base,
    type: z.literal("STOP"),
    sessionId: id.optional(),
    stopReason: z.enum(["USER", "SWITCH", "SHUTDOWN", "RECOVERY"]).optional(),
    note: z.string().trim().max(500).optional(),
  }),
]);

export type CompanionTimerOp = z.infer<typeof companionTimerOpSchema>;

export const companionTimerOpsSchema = z.object({
  ops: z.array(companionTimerOpSchema).min(1).max(50),
});
