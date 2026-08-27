import { z } from "zod";

export const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional().default(""),
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().optional().default(""),
  dueTime: z.string().optional().default(""),
  assignedToId: z.string().optional().default(""),
  customerId: z.string().optional().default(""),
  orderId: z.string().optional().default(""),
  quotationId: z.string().optional().default(""),
  invoiceId: z.string().optional().default(""),
  productionJobId: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  reminder: z.string().optional().default(""),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export function taskFormDefaults(overrides?: Partial<TaskFormValues>): TaskFormValues {
  return {
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "",
    dueTime: "",
    assignedToId: "",
    customerId: "",
    orderId: "",
    quotationId: "",
    invoiceId: "",
    productionJobId: "",
    tags: "",
    reminder: "",
    ...overrides,
  };
}

