import "server-only";

import { randomInt } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

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

export function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

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

const TEMP_ALPHABET =
  "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TEMPORARY_PASSWORD_LENGTH = 16;

export function generateTemporaryPassword(): string {
  let out = "";
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) {
    out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  }
  return out;
}

export type PasswordPolicyField = "newPassword" | "confirmPassword";

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
