import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/services/activity";
import { createNotification } from "@/lib/services/notifications";
import { getTaskDetail } from "@/lib/services/tasks";

// Comments follow the task: anyone who can see a task (getTaskDetail applies the client,
// employee and admin scoping) can read and post. Only the author edits; the author or an
// admin deletes.

async function visibleTask(taskId: string, user: SessionUser) {
  const task = await getTaskDetail(taskId, user);
  if (!task) throw new Error("That task could not be found.");
  return task;
}

export async function listTaskComments(taskId: string, user: SessionUser) {
  await visibleTask(taskId, user);
  return prisma.taskComment.findMany({
    where: { taskId },
    select: {
      id: true,
      body: true,
      authorId: true,
      editedAt: true,
      createdAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
}

export type TaskCommentRow = Awaited<ReturnType<typeof listTaskComments>>[number];

export async function addTaskComment(user: SessionUser, input: { taskId: string; body: string }) {
  const task = await visibleTask(input.taskId, user);
  const comment = await prisma.taskComment.create({
    data: { taskId: task.id, authorId: user.id, body: input.body },
    select: { id: true },
  });

  await logActivity({
    type: "task.commented",
    message: `${user.name} commented on "${task.title}"`,
    entityType: "task",
    entityId: task.id,
    taskId: task.id,
    projectId: task.projectId,
    userId: user.id,
  });

  // Tell the people following the thread: the assignee, the creator, tagged people and earlier commenters.
  const earlier = await prisma.taskComment.findMany({
    where: { taskId: task.id },
    select: { authorId: true },
    distinct: ["authorId"],
  });
  const recipients = new Set<string>(earlier.map((c) => c.authorId));
  if (task.assignedToId) recipients.add(task.assignedToId);
  if (task.createdById) recipients.add(task.createdById);
  for (const m of task.mentions) recipients.add(m.employeeId);
  recipients.delete(user.id);

  const preview = input.body.length > 120 ? `${input.body.slice(0, 117)}…` : input.body;
  await Promise.all(
    [...recipients].map((userId) =>
      createNotification({
        userId,
        title: "New comment on a task",
        message: `${user.name} on "${task.title}": ${preview}`,
        type: "TASK_COMMENT",
        link: `/tasks/${task.id}`,
      }),
    ),
  );
  return comment.id;
}

export async function updateTaskComment(user: SessionUser, input: { commentId: string; body: string }) {
  const comment = await prisma.taskComment.findUnique({
    where: { id: input.commentId },
    select: { id: true, taskId: true, authorId: true },
  });
  if (!comment) throw new Error("That comment could not be found.");
  await visibleTask(comment.taskId, user);
  if (comment.authorId !== user.id) throw new Error("You can only edit your own comments.");
  await prisma.taskComment.update({ where: { id: comment.id }, data: { body: input.body, editedAt: new Date() } });
  return comment.taskId;
}

export async function deleteTaskComment(user: SessionUser, commentId: string) {
  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { id: true, taskId: true, authorId: true },
  });
  if (!comment) throw new Error("That comment could not be found.");
  await visibleTask(comment.taskId, user);
  if (comment.authorId !== user.id && user.role !== "ADMIN") {
    throw new Error("Only the author or an admin can delete this comment.");
  }
  await prisma.taskComment.delete({ where: { id: comment.id } });
  return comment.taskId;
}
