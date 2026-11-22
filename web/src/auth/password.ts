import "server-only";

import { randomInt } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

/**
 * Password hashing for Better Auth (`emailAndPassword.password`) and for
 * AccountAdminApi, which writes hashes inside the caller's transaction.
 *
 * New hashes: argon2id at the OWASP baseline (m = 19 MiB, t = 2, p = 1).
 * The @node-rs/argon2 default algorithm is argon2id; tests assert the
 * `$argon2id$` prefix. Verify accepts argon2id only.
 */
export const ARGON2_OPTIONS = {
  memoryCost: 19_456, // KiB = 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const ARGON2ID_PREFIX = "$argon2id$";

export function isArgon2idHash(stored: string): boolean {
  return stored.startsWith(ARGON2ID_PREFIX);
}

/** argon2id hash of `password`. */
export function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

/**
 * true if `password` matches the argon2id `hash`. Other formats,
 * malformed hashes and plain text never match, and this never throws.
 */
export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  try {
    if (isArgon2idHash(hash)) return await argon2Verify(hash, password);
    return false;
  } catch {
    return false;
  }
}

// No look-alike characters (0/O, 1/l/I), so HR can read it out.
const TEMP_ALPHABET =
  "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TEMPORARY_PASSWORD_LENGTH = 16;

/** Random temporary password (CSPRNG, ~92 bits). Shown once, never stored in plain text. */
export function generateTemporaryPassword(): string {
  let out = "";
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) {
    out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  }
  return out;
}

export type PasswordPolicyField = "newPassword" | "confirmPassword";

/**
 * Policy for passwords users choose (contract Auth rule 5). Returns field
 * errors, or null when the password is acceptable.
 */
export function checkPasswordPolicy(input: {
  newPassword: string;
  confirmPassword: string;
  username: string;
}): Partial<Record<PasswordPolicyField, string[]>> | null {
  const { newPassword, confirmPassword, username } = input;
  const errors: string[] = [];
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (newPassword.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Use at most ${PASSWORD_MAX_LENGTH} characters.`);
  }
  if (newPassword.trim().toLowerCase() === username.toLowerCase()) {
    errors.push("The password must not be your username.");
  }
  if (errors.length > 0) return { newPassword: errors };
  if (newPassword !== confirmPassword) {
    return { confirmPassword: ["The passwords do not match."] };
  }
  return null;
}
