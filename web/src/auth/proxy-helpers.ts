import { getSessionCookie } from "better-auth/cookies";
import { MUST_CHANGE_COOKIE } from "./paths";

export function hasSessionCookie(request: Request): boolean {
  return getSessionCookie(request) !== null;
}

export function hasMustChangeHint(cookieValue: string | undefined): boolean {
  return cookieValue === "1";
}

export { MUST_CHANGE_COOKIE };
