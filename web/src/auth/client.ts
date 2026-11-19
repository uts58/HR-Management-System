import type { ActionResult, AuthClientApi, SignInInput } from "@/contracts";
import {
  CHANGE_PASSWORD_PATH,
  DASHBOARD_PATH,
  safeCallbackPath,
} from "./paths";

/**
 * Browser-side sign-in (contract AuthClientApi). The only file in
 * web/src/auth that client components may import. No server-only code and
 * no better-auth import: it is one fetch to Better Auth's endpoint.
 *
 * Usage in the login form (client component):
 *
 *   const result = await signInWithUsername({ username, password }, callbackUrl);
 *   if (result.ok) router.replace(result.data.redirectTo);
 *   else setError(result.error.message);
 */

export const INVALID_LOGIN_MESSAGE = "Invalid username or password";
export const RATE_LIMITED_MESSAGE = "Too many attempts, try again shortly";

function fail(
  code: "VALIDATION" | "INTERNAL",
  message: string,
): ActionResult<never> {
  return { ok: false, error: { code, message } };
}

export async function signInWithUsername(
  input: SignInInput,
  callbackUrl?: string | null,
): Promise<ActionResult<{ redirectTo: string }>> {
  const username = input.username.trim();
  if (!username || !input.password) {
    return fail("VALIDATION", INVALID_LOGIN_MESSAGE);
  }

  let response: Response;
  try {
    response = await fetch("/api/auth/sign-in/username", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password: input.password }),
    });
  } catch {
    return fail("INTERNAL", "Could not reach the server. Please try again.");
  }

  if (response.status === 429) return fail("VALIDATION", RATE_LIMITED_MESSAGE);
  // Every other failure (unknown user, wrong password, disabled account,
  // malformed username) gets the same message: no user enumeration.
  if (!response.ok) {
    return response.status >= 500
      ? fail("INTERNAL", "Something went wrong. Please try again.")
      : fail("VALIDATION", INVALID_LOGIN_MESSAGE);
  }

  let mustChangePassword = false;
  try {
    const body = (await response.json()) as {
      user?: { mustChangePassword?: unknown };
    };
    mustChangePassword = body.user?.mustChangePassword === true;
  } catch {
    // Signed in but the body was unreadable; the server still enforces
    // the forced change on the next page.
  }

  const redirectTo = mustChangePassword
    ? CHANGE_PASSWORD_PATH
    : (safeCallbackPath(callbackUrl) ?? DASHBOARD_PATH);
  return { ok: true, data: { redirectTo } };
}

/** Typed against the contract, so a signature drift fails typecheck. */
export const authClient: AuthClientApi = {
  signInWithUsername: (input) => signInWithUsername(input),
};
