import "server-only";

import { cookies, headers } from "next/headers";
import type { ChangePasswordInput } from "@/contracts";
import { getAuth } from "./config";
import { prisma } from "./db";
import { AuthServiceError } from "./errors";
import { MUST_CHANGE_COOKIE } from "./paths";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "./password";
import type { LoadedSession } from "./session";

/**
 * Server-side work behind the AuthActions in ./actions.ts. Failures throw
 * AuthServiceError (ServiceError shape), which defineAction's runAction
 * maps to `{ ok: false, error }`.
 */

const WRONG_CURRENT = "Current password is incorrect";

/**
 * Change the password of the user behind `current`, keeping `current`
 * signed in.
 *
 * Input is expected to have passed changePasswordSchema already (lengths,
 * confirmation, differs from current). This re-checks the policy anyway,
 * plus what needs the database: the current password (argon2id or legacy
 * bcrypt) and "not equal to the username". Then, in one transaction: write
 * an argon2id hash (compare-and-swap on the old hash), clear
 * mustChangePassword, delete every other session of the user.
 */
export async function changePasswordForSession(
  current: LoadedSession,
  input: ChangePasswordInput,
): Promise<void> {
  const { user } = current.session;

  const account = await prisma.account.findFirst({
    where: { userId: user.userId, providerId: "credential" },
    select: { id: true, password: true },
  });
  const oldHash = account?.password ?? null;
  const ok =
    oldHash !== null &&
    (await verifyPassword({ hash: oldHash, password: input.currentPassword }));
  if (!account || oldHash === null || !ok) {
    throw new AuthServiceError("VALIDATION", WRONG_CURRENT, {
      currentPassword: [WRONG_CURRENT],
    });
  }

  const policy = checkPasswordPolicy({
    newPassword: input.newPassword,
    confirmPassword: input.confirmPassword,
    username: user.username,
  });
  if (policy) {
    throw new AuthServiceError(
      "VALIDATION",
      "Please correct the highlighted fields.",
      policy,
    );
  }
  if (input.newPassword === input.currentPassword) {
    throw new AuthServiceError(
      "VALIDATION",
      "Please correct the highlighted fields.",
      {
        newPassword: [
          "New password must be different from the current password",
        ],
      },
    );
  }

  const newHash = await hashPassword(input.newPassword);
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.account.updateMany({
      where: { id: account.id, password: oldHash },
      data: { password: newHash },
    });
    if (count !== 1) return false; // changed concurrently (e.g. HR reset)
    await tx.user.update({
      where: { id: user.userId },
      data: { mustChangePassword: false },
    });
    await tx.session.deleteMany({
      where: { userId: user.userId, id: { not: current.sessionId } },
    });
    return true;
  });
  if (!changed) {
    throw new AuthServiceError(
      "CONFLICT",
      "Your password was changed elsewhere. Please sign in again.",
    );
  }

  try {
    (await cookies()).delete(MUST_CHANGE_COOKIE);
  } catch {
    // Outside a server action/route handler (tests); the hint is harmless.
  }
}

/** End the request's session. Safe to call when signed out. */
export async function signOutCurrentSession(): Promise<void> {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch {
    // No session or already revoked: nothing to do.
  }
  try {
    (await cookies()).delete(MUST_CHANGE_COOKIE);
  } catch {
    // Outside a server action/route handler.
  }
}
