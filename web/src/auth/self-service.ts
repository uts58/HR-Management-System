import "server-only";

import { cookies, headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import type { ChangePasswordInput } from "@/contracts";
import { getAuth } from "./config";
import { prisma } from "./db";
import { AuthServiceError } from "./errors";
import { changePasswordLimiter } from "./login-limiter";
import { MUST_CHANGE_COOKIE } from "./paths";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "./password";
import type { LoadedSession } from "./session";

const WRONG_CURRENT = "Current password is incorrect";
const TOO_MANY_ATTEMPTS = "Too many attempts, try again shortly";

export async function changePasswordForSession(
  current: LoadedSession,
  input: ChangePasswordInput,
): Promise<void> {
  const { user } = current.session;

  if (changePasswordLimiter.retryAfterSeconds(user.userId) > 0) {
    throw new AuthServiceError("VALIDATION", TOO_MANY_ATTEMPTS, {
      currentPassword: [TOO_MANY_ATTEMPTS],
    });
  }

  const account = await prisma.account.findFirst({
    where: { userId: user.userId, providerId: "credential" },
    select: { id: true, password: true },
  });
  const oldHash = account?.password ?? null;
  const ok =
    oldHash !== null &&
    (await verifyPassword({ hash: oldHash, password: input.currentPassword }));
  if (!account || oldHash === null || !ok) {
    changePasswordLimiter.recordFailure(user.userId);
    throw new AuthServiceError("VALIDATION", WRONG_CURRENT, {
      currentPassword: [WRONG_CURRENT],
    });
  }
  changePasswordLimiter.recordSuccess(user.userId);

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
    if (count !== 1) return false;
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
  } catch (err) {
    unstable_rethrow(err);
  }
}

export async function signOutCurrentSession(): Promise<void> {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch (err) {
    unstable_rethrow(err);
  }
  try {
    (await cookies()).delete(MUST_CHANGE_COOKIE);
  } catch (err) {
    unstable_rethrow(err);
  }
}
