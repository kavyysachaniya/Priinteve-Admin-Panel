import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import type { UserRole } from "@prisma/client";

const USER_RECHECK_INTERVAL_MS = 60_000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        try {
          const user = await prisma.user.findUnique({ where: { email } });

          // Always perform a hash comparison to prevent timing attacks
          // even if user is not found
          if (!user || !user.passwordHash) {
            // Dummy comparison to prevent timing attacks
            await verifyPassword(password, "$2a$12$dummyhashfordummycomparison.dummydummydummy");
            return null;
          }

          if (user.status !== "ACTIVE") return null;

          const valid = await verifyPassword(password, user.passwordHash);
          if (!valid) return null;

          // Update lastLoginAt asynchronously (don't block login)
          prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }).catch(() => {/* non-critical */});

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as UserRole,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.checkedAt = Date.now();
        return token;
      }

      // The JWT otherwise carries whatever role/status the user had at sign-in. Re-read them
      // periodically so deactivation or a role change takes effect without waiting for re-login.
      if (!token.id) return null;
      if (Date.now() - (token.checkedAt ?? 0) < USER_RECHECK_INTERVAL_MS) return token;

      try {
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, status: true },
        });
        if (!current || current.status !== "ACTIVE") return null;
        token.role = current.role;
        token.checkedAt = Date.now();
      } catch {
        // A transient DB failure shouldn't sign everyone out; keep the last known values.
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
