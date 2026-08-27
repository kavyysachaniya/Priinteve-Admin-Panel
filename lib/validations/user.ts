import { z } from "zod";

export const userFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().email("Please enter a valid email address").toLowerCase(),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long")
    .optional()
    .or(z.literal("")),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm the password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
