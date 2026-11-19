import "server-only";

import { prisma } from "./db";
import { hashPassword, needsRehash } from "./password";

/** Minimal slice of the Prisma client this module needs (lets unit tests pass a fake). */
export interface RehashStore {
  account: {
    findFirst(args: {
      where: { userId: string; providerId: "credential" };
      select: { id: true; password: true };
    }): Promise<{ id: string; password: string | null } | null>;
    updateMany(args: {
      where: { id: string; password: string };
      data: { password: string };
    }): Promise<{ count: number }>;
  };
}

export type RehashResult = "rehashed" | "not-needed" | "lost-race" | "failed";

/**
 * After a successful sign-in: if the stored hash is legacy bcrypt, replace
 * it with an argon2id hash of the password the user just proved they know.
 *
 * Compare-and-swap: the UPDATE only applies while the row still holds the
 * exact bcrypt hash we read, so a password changed concurrently (by the
 * user or by HR) is never overwritten. Never throws: a failed rehash is
 * logged and the login proceeds.
 */
export async function rehashLegacyPassword(
  userId: string,
  password: string,
  store: RehashStore = prisma as unknown as RehashStore,
): Promise<RehashResult> {
  try {
    const account = await store.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true, password: true },
    });
    if (!account?.password || !needsRehash(account.password)) {
      return "not-needed";
    }
    const newHash = await hashPassword(password);
    const { count } = await store.account.updateMany({
      where: { id: account.id, password: account.password },
      data: { password: newHash },
    });
    return count === 1 ? "rehashed" : "lost-race";
  } catch (err) {
    // Never log the password or hashes.
    console.error(
      JSON.stringify({
        level: "error",
        msg: "auth: legacy password rehash failed",
        userId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return "failed";
  }
}
