import {
  expect,
  type APIResponse,
  type BrowserContext,
} from "@playwright/test";

import type { TestUser } from "./users";

let ipCounter = Math.floor(Math.random() * 60_000);

export function nextClientIp(): string {
  ipCounter = (ipCounter + 1) % 131_072;
  return `198.${18 + (ipCounter >> 16)}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

export const SIGN_IN_PATH = "/api/auth/sign-in/username";

const STUB_PERSONA_COOKIE = "hr-stub-persona";
function stubPersonaFor(user: TestUser): string {
  if (user.mustChangePassword) return "must-change";
  return user.role === "HR_ADMIN" ? "hr" : "employee";
}

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
