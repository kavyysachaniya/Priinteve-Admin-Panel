import { z } from "zod";

export const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200, "Project name cannot exceed 200 characters"),
  code: z
    .string()
    .trim()
    .max(20, "Project code cannot exceed 20 characters")
    .regex(/^[A-Za-z0-9._-]*$/, "Use letters, numbers, dots, dashes or underscores only")
    .optional(),
  description: z.string().min(1, "Project description is required"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("NOT_STARTED"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  customerId: z.string().optional().default(""),
  assignedToId: z.string().optional().default(""),
  assignedEmployeeIds: z.array(z.string()).optional(),
  startDate: z.string().optional().default(""),
  dueDate: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function projectFormDefaults(overrides?: Partial<ProjectFormValues>): ProjectFormValues {
  return {
    name: "",
    code: "",
    description: "",
    status: "NOT_STARTED",
    priority: "MEDIUM",
    customerId: "",
    assignedToId: "",
    assignedEmployeeIds: [],
    startDate: "",
    dueDate: "",
    notes: "",
    ...overrides,
  };
}

export const assignEmployeesSchema = z.object({
  employeeIds: z.array(z.string()),
});
export type AssignEmployeesValues = z.infer<typeof assignEmployeesSchema>;

export const startTimerSchema = z.object({
  taskDescription: z.string().min(3, "Task description must be at least 3 characters"),
  taskId: z.string().optional().nullable(),
});
export type StartTimerValues = z.infer<typeof startTimerSchema>;

export const stopTimerSchema = z.object({
  taskDescription: z.string().optional(),
});
export type StopTimerValues = z.infer<typeof stopTimerSchema>;

const correctionReason = z
  .string()
  .trim()
  .min(3, "Say briefly why this time is being corrected (min 3 characters).")
  .max(500, "Keep the reason under 500 characters.");

// Duration is always derived from the start and end times, and an end time can't be removed.
export const timeEntryUpdateSchema = z.object({
  taskDescription: z.string().min(3, "Task description must be at least 3 characters").optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  reason: correctionReason,
});
export type TimeEntryUpdateValues = z.infer<typeof timeEntryUpdateSchema>;

export const timeEntryDeleteSchema = z.object({ reason: correctionReason });
