import { z } from "zod";

// "My account": every signed-in user (admin, employee or client) can change their own
// display name and password. Email and role are managed by admins on /users.

export const accountNameSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
});

export type AccountNameValues = z.infer<typeof accountNameSchema>;

export const accountPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm the new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "Choose a password different from the current one",
    path: ["newPassword"],
  });

export type AccountPasswordValues = z.infer<typeof accountPasswordSchema>;
