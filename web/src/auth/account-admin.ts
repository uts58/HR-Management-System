import "server-only";

import { randomUUID } from "node:crypto";
import {
  USERNAME_PATTERN,
  type AccountAdminApi,
  type CreateLoginAccountInput,
  type IssuedCredentials,
  type UserId,
} from "@/contracts";
import { Prisma } from "@/generated/prisma/client";
import type { TxClient } from "./db";
import { AuthServiceError } from "./errors";
import { generateTemporaryPassword, hashPassword } from "./password";

/**
 * AccountAdminApi (contract): server-only helpers Backend's employee
 * service calls inside its own transaction. They write Better Auth's tables
 * directly with the caller's `tx` (auth.api can't join an outside
 * transaction), using the same argon2id hash as the Better Auth config.
 */

export const PLACEHOLDER_EMAIL_DOMAIN = "users.invalid";
const USERNAME_RE = new RegExp(USERNAME_PATTERN);
// Deliberately loose: Better Auth only needs uniqueness; the employee
// record keeps the contact email as entered.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asTx(tx: unknown): TxClient {
  return tx as TxClient;
}

function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function placeholderEmail(username: string): string {
  return `${username}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function isUniqueViolation(err: unknown, field: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  const target = JSON.stringify(err.meta ?? {});
  return target.includes(field);
}

/** Pick the user's auth email: the real one if usable and free, else the placeholder. */
async function chooseEmail(
  tx: TxClient,
  username: string,
  email: string | null | undefined,
): Promise<{ email: string; emailIsPlaceholder: boolean }> {
  const candidate = email?.trim().toLowerCase() ?? "";
  if (
    candidate &&
    EMAIL_RE.test(candidate) &&
    !candidate.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
  ) {
    const taken = await tx.user.findFirst({
      where: { email: { equals: candidate, mode: "insensitive" } },
      select: { id: true },
    });
    if (!taken) return { email: candidate, emailIsPlaceholder: false };
  }
  return { email: placeholderEmail(username), emailIsPlaceholder: true };
}

async function createLoginAccount<Tx>(
  txArg: Tx,
  input: CreateLoginAccountInput,
): Promise<{ userId: UserId; credentials: IssuedCredentials }> {
  const tx = asTx(txArg);
  const username = normaliseUsername(input.username);
  if (!USERNAME_RE.test(username)) {
    throw new AuthServiceError("VALIDATION", "Username is invalid.", {
      username: [
        "Use 3-30 characters: lower-case letters, digits, dots and underscores.",
      ],
    });
  }
  const conflict = () =>
    new AuthServiceError("CONFLICT", "That username is already taken.", {
      username: ["That username is already taken."],
    });

  const existing = await tx.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing) throw conflict();

  const { email, emailIsPlaceholder } = await chooseEmail(
    tx,
    username,
    input.email,
  );
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const userId = randomUUID();

  try {
    await tx.user.create({
      data: {
        id: userId,
        name: input.displayName.trim() || username,
        email,
        emailIsPlaceholder,
        emailVerified: false,
        username,
        displayUsername: input.username.trim(),
        role: input.role,
        mustChangePassword: true,
        employeeId: input.employeeId,
      },
    });
  } catch (err) {
    // Concurrent create with the same username (or email) slipped past the checks above.
    if (isUniqueViolation(err, "username")) throw conflict();
    throw err;
  }
  await tx.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    },
  });

  return { userId, credentials: { username, temporaryPassword } };
}

async function issueTemporaryPassword<Tx>(
  txArg: Tx,
  userId: UserId,
): Promise<IssuedCredentials> {
  const tx = asTx(txArg);
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
  if (!user)
    throw new AuthServiceError("NOT_FOUND", "Login account not found.");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const credential = await tx.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });
  if (credential) {
    await tx.account.update({
      where: { id: credential.id },
      data: { password: passwordHash },
    });
  } else {
    // Migrated users whose legacy password was empty have no credential row.
    await tx.account.create({
      data: {
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
      },
    });
  }
  await tx.user.update({
    where: { id: userId },
    data: { mustChangePassword: true },
  });
  await tx.session.deleteMany({ where: { userId } });

  return { username: user.username, temporaryPassword };
}

async function disableLogin<Tx>(txArg: Tx, userId: UserId): Promise<void> {
  const tx = asTx(txArg);
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user)
    throw new AuthServiceError("NOT_FOUND", "Login account not found.");
  // Keep the first disable time if it was already disabled.
  await tx.user.updateMany({
    where: { id: userId, disabledAt: null },
    data: { disabledAt: new Date() },
  });
  await tx.session.deleteMany({ where: { userId } });
}

export const DISPLAY_NAME_MAX_LENGTH = 200;

/** Trimmed display name, or a VALIDATION error. Exported for unit tests. */
export function normaliseDisplayName(name: unknown): string {
  const trimmed =
    typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  if (!trimmed) {
    throw new AuthServiceError("VALIDATION", "Display name is required.", {
      name: ["Display name is required."],
    });
  }
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new AuthServiceError("VALIDATION", "Display name is too long.", {
      name: [`Use at most ${DISPLAY_NAME_MAX_LENGTH} characters.`],
    });
  }
  // Control characters (incl. newlines) never belong in a header name.
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new AuthServiceError("VALIDATION", "Display name is invalid.", {
      name: ["Display name contains invalid characters."],
    });
  }
  return trimmed;
}

/**
 * Sets Better Auth's `user.name` (header/menu name) when HR renames an
 * employee. Never touches the username. NOT_FOUND for an unknown user.
 */
async function updateDisplayName<Tx>(
  txArg: Tx,
  userId: UserId,
  name: string,
): Promise<void> {
  const tx = asTx(txArg);
  const displayName = normaliseDisplayName(name);
  const { count } = await tx.user.updateMany({
    where: { id: userId },
    data: { name: displayName },
  });
  if (count === 0) {
    throw new AuthServiceError("NOT_FOUND", "Login account not found.");
  }
}

export const accountAdmin: AccountAdminApi = {
  createLoginAccount,
  issueTemporaryPassword,
  disableLogin,
  updateDisplayName,
};
