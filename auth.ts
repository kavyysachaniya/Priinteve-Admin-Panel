import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import type { UserRole } from "@prisma/client";

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
        token.role = (user as any).role as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as UserRole;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
