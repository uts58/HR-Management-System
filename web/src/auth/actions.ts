"use server";

import { z } from "zod";
import { changePasswordSchema } from "@/lib/validation/auth";
import { defineAction } from "@/server/action";
import {
  changePasswordForSession,
  signOutCurrentSession,
} from "./self-service";
import { loadCurrentSession } from "./session";
import { AuthError } from "./errors";

/**
 * AuthActions (contract). Sign-in is NOT here: it goes from the browser to
 * Better Auth's /api/auth/sign-in/username (see ./client.ts), because the
 * built-in rate limiter only covers HTTP requests.
 */

/**
 * Change the signed-in user's password. Allowed while mustChangePassword is
 * set. Revokes the user's other sessions and clears the flag.
 */
export const changePassword = defineAction({
  role: "ANY",
  allowPendingPasswordChange: true,
  schema: changePasswordSchema,
  handler: async (_actor, input) => {
    // defineAction already resolved the session; this reads the same
    // per-request memoised value, plus the session id we need to keep.
    const current = await loadCurrentSession();
    if (!current) throw new AuthError("UNAUTHENTICATED");
    await changePasswordForSession(current, input);
  },
});

/**
 * End the current session. PUBLIC (no session check): idempotent, so it
 * returns ok even when already signed out or the session expired, and
 * works while a password change is pending. It only ever ends the
 * caller's own session (from the request cookie).
 */
export const signOut = defineAction({
  role: "PUBLIC",
  schema: z.unknown(),
  handler: async () => {
    await signOutCurrentSession();
  },
});
