import {
  expect,
  type APIResponse,
  type BrowserContext,
} from "@playwright/test";

import type { TestUser } from "./users";

/**
 * Sign-in helpers. Better Auth rate-limits /api/auth/sign-in/username to
 * 10 per minute per client IP, and takes the client IP from
 * X-Forwarded-For (ADR-0004; Caddy overwrites the header in production).
 * Every browser context therefore presents its own client IP, so the limit
 * applies per test instead of across the whole run.
 */

let ipCounter = Math.floor(Math.random() * 60_000);

/** A fresh address in 198.18.0.0/15 (benchmarking range, never a real client). */
export function nextClientIp(): string {
  ipCounter = (ipCounter + 1) % 131_072;
  return `198.${18 + (ipCounter >> 16)}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

export const SIGN_IN_PATH = "/api/auth/sign-in/username";

/**
 * STUB BRIDGE (remove with web/src/app/_stubs): while pages read the stub
 * session, the persona cookie decides which role the page renders for. We
 * set it to match the user who really signed in, so a test signed in as an
 * employee also sees the employee variant of a stub page. Harmless once the
 * stubs are deleted (nothing reads the cookie).
 */
const STUB_PERSONA_COOKIE = "hr-stub-persona";
function stubPersonaFor(user: TestUser): string {
  if (user.mustChangePassword) return "must-change";
  return user.role === "HR_ADMIN" ? "hr" : "employee";
}

/** POST the sign-in endpoint from this context (cookies land in the context). */
export async function postSignIn(
  context: BrowserContext,
  baseURL: string,
  username: string,
  password: string,
): Promise<APIResponse> {
  return context.request.post(SIGN_IN_PATH, {
    data: { username, password },
    headers: { origin: new URL(baseURL).origin },
  });
}

/**
 * Real sign-in through Better Auth's HTTP endpoint (the same call the login
 * form makes). Used by fixtures for speed; the login form itself is covered
 * by tests/e2e/auth.spec.ts.
 */
export async function signInViaApi(
  context: BrowserContext,
  baseURL: string,
  user: TestUser,
): Promise<void> {
  const res = await postSignIn(context, baseURL, user.username, user.password);
  expect(
    res.ok(),
    `sign-in as ${user.username} failed: HTTP ${res.status()} ${await res.text()}`,
  ).toBe(true);
  await context.addCookies([
    { name: STUB_PERSONA_COOKIE, value: stubPersonaFor(user), url: baseURL },
  ]);
}
