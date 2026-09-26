import { z } from "zod";

export const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200, "Project name cannot exceed 200 characters"),
  description: z.string().min(1, "Project description is required"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("NOT_STARTED"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  customerId: z.string().optional().default(""),
  assignedToId: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  dueDate: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function projectFormDefaults(overrides?: Partial<ProjectFormValues>): ProjectFormValues {
  return {
    name: "",
    description: "",
    status: "NOT_STARTED",
    priority: "MEDIUM",
    customerId: "",
    assignedToId: "",
    startDate: "",
    dueDate: "",
    notes: "",
    ...overrides,
  };
}
