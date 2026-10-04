import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import type { UserRole } from "@prisma/client";

const USER_RECHECK_INTERVAL_MS = 60_000;

// In-memory brute force protection for login attempts per email
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  blockedUntil?: number;
}
const loginAttempts = new Map<string, LoginAttempt>();
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function recordFailedLogin(email: string) {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now - entry.lastAttempt > ATTEMPT_WINDOW_MS) {
    loginAttempts.set(email, { count: 1, lastAttempt: now });
  } else {
    entry.count += 1;
    entry.lastAttempt = now;
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      entry.blockedUntil = now + BLOCK_DURATION_MS;
    }
  }

  // Periodic cleanup if map grows
  if (loginAttempts.size > 1000) {
    for (const [k, v] of loginAttempts.entries()) {
      if (now - v.lastAttempt > ATTEMPT_WINDOW_MS && (!v.blockedUntil || v.blockedUntil <= now)) {
        loginAttempts.delete(k);
      }
    }
  }
}

function clearFailedLogin(email: string) {
  loginAttempts.delete(email);
}

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

        // Check brute-force lockout
        const attempt = loginAttempts.get(email);
        const now = Date.now();
        if (attempt?.blockedUntil && attempt.blockedUntil > now) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({ where: { email } });

          // Always perform a hash comparison to prevent timing attacks
          // even if user is not found
          if (!user || !user.passwordHash) {
            // Dummy comparison to prevent timing attacks
            await verifyPassword(password, "$2a$12$dummyhashfordummycomparison.dummydummydummy");
            recordFailedLogin(email);
            return null;
          }

          if (user.status !== "ACTIVE") {
            recordFailedLogin(email);
            return null;
          }

          const valid = await verifyPassword(password, user.passwordHash);
          if (!valid) {
            recordFailedLogin(email);
            return null;
          }

          clearFailedLogin(email);

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
            customerId: user.customerId,
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
        token.customerId = user.customerId;
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
          select: { role: true, status: true, customerId: true },
        });
        if (!current || current.status !== "ACTIVE") return null;
        token.role = current.role;
        token.customerId = current.customerId;
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
        session.user.customerId = (token.customerId as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
