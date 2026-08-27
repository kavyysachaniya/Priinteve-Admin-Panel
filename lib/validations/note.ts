import { z } from "zod";

export const noteFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
  tags: z.string().optional().default(""),
  pinned: z.boolean().default(false),
  customerId: z.string().optional().default(""),
  orderId: z.string().optional().default(""),
  taskId: z.string().optional().default(""),
});

export type NoteFormValues = z.infer<typeof noteFormSchema>;

export function noteFormDefaults(overrides?: Partial<NoteFormValues>): NoteFormValues {
  return {
    title: "",
    content: "",
    tags: "",
    pinned: false,
    customerId: "",
    orderId: "",
    taskId: "",
    ...overrides,
  };
}

