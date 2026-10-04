import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import type { UserRole, UserStatus } from "@prisma/client";

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
  customerId?: string | null;
  createdById?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
  customerId?: string | null;
}

export async function listUsers() {
  try {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        customerId: true,
        customer: { select: { id: true, name: true } },
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return [];
  }
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      customerId: true,
      customer: { select: { id: true, name: true } },
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createUser(input: CreateUserInput) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase().trim(),
      passwordHash,
      role: input.role,
      status: input.status ?? "ACTIVE",
      customerId: input.customerId || null,
      createdById: input.createdById,
    },
  });
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) data.email = input.email.toLowerCase().trim();
  if (input.role !== undefined) data.role = input.role;
  if (input.status !== undefined) data.status = input.status;
  if (input.customerId !== undefined) data.customerId = input.customerId || null;
  if (input.password) data.passwordHash = await hashPassword(input.password);

  return prisma.user.update({ where: { id }, data });
}

export async function deactivateUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { status: "INACTIVE" },
  });
}

export async function activateUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
}

export async function getUserCount() {
  return prisma.user.count();
}

export async function listActiveEmployees() {
  try {
    return await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { in: ["ADMIN", "EMPLOYEE"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

