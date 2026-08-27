import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash a plain-text password using bcrypt with 12 salt rounds.
 * Never store the plain password anywhere.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Verify a plain-text password against a stored bcrypt hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
