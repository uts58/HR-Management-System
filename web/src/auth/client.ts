import type { ActionResult, AuthClientApi, SignInInput } from "@/contracts";
import {
  CHANGE_PASSWORD_PATH,
  DASHBOARD_PATH,
  safeCallbackPath,
} from "./paths";

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
  } catch {}

  const redirectTo = mustChangePassword
    ? CHANGE_PASSWORD_PATH
    : (safeCallbackPath(callbackUrl) ?? DASHBOARD_PATH);
  return { ok: true, data: { redirectTo } };
}

export const authClient: AuthClientApi = {
  signInWithUsername: (input) => signInWithUsername(input),
};
