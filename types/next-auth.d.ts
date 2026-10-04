import { UserRole } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: UserRole;
    customerId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      customerId?: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    customerId?: string | null;
    /** Epoch ms when role/status were last re-read from the database. */
    checkedAt?: number;
  }
}

