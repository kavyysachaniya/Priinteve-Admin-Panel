import { z } from "zod";

export const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional().default(""),
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  projectId: z.string().optional().default(""),
  dueDate: z.string().optional().default(""),
  dueTime: z.string().optional().default(""),
  assignedToId: z.string().optional().default(""),
  assigneeId: z.string().optional().default(""),
  mentionUserIds: z.array(z.string()).optional().default([]),
  customerId: z.string().optional().default(""),
  orderId: z.string().optional().default(""),
  quotationId: z.string().optional().default(""),
  invoiceId: z.string().optional().default(""),
  productionJobId: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  reminder: z.string().optional().default(""),
  /** Planned effort in minutes; blank for none. */
  estimatedMinutes: z
    .string()
    .regex(/^\d{0,5}$/, "Planned time must be a whole number of minutes")
    .optional(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export function taskFormDefaults(overrides?: Partial<TaskFormValues>): TaskFormValues {
  return {
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    projectId: "",
    dueDate: "",
    dueTime: "",
    assignedToId: "",
    assigneeId: "",
    mentionUserIds: [],
    customerId: "",
    orderId: "",
    quotationId: "",
    invoiceId: "",
    productionJobId: "",
    tags: "",
    reminder: "",
    estimatedMinutes: "",
    ...overrides,
  };
}

export const moveTaskSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  aboveId: z.string().min(1).nullable().optional(),
  belowId: z.string().min(1).nullable().optional(),
});

export type MoveTaskValues = z.infer<typeof moveTaskSchema>;
