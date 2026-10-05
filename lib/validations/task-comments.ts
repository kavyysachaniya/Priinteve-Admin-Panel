import { z } from "zod";

export const TASK_COMMENT_MAX = 4000;

export const taskCommentSchema = z.object({
  taskId: z.string().trim().min(1).max(40),
  body: z
    .string()
    .trim()
    .min(1, "Write a comment first")
    .max(TASK_COMMENT_MAX, `Comments can be up to ${TASK_COMMENT_MAX} characters`),
});

export const taskCommentEditSchema = z.object({
  commentId: z.string().trim().min(1).max(40),
  body: taskCommentSchema.shape.body,
});

export type TaskCommentValues = z.infer<typeof taskCommentSchema>;
