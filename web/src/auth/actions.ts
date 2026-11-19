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
 * End the current session.
 *
 * TODO(Backend PUBLIC role): switch to `role: "PUBLIC"` once defineAction
 * supports it, so a signed-out call succeeds quietly. With "ANY", a call
 * without a valid session returns UNAUTHENTICATED, which the UI can treat
 * as "already signed out".
 */
export const signOut = defineAction({
  role: "ANY",
  allowPendingPasswordChange: true,
  schema: z.unknown(),
  handler: async () => {
    await signOutCurrentSession();
  },
});
