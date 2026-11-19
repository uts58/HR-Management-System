/**
 * Route and cookie names shared by proxy.ts, the session helpers and the
 * client sign-in wrapper. No server-only import: proxy.ts and the browser
 * bundle use this file.
 */
export const LOGIN_PATH = "/login";
export const CHANGE_PASSWORD_PATH = "/change-password";
export const DASHBOARD_PATH = "/dashboard";
/** Page shown for FORBIDDEN in redirect mode (Frontend provides it). */
export const FORBIDDEN_PATH = "/forbidden";

/**
 * Set at sign-in when the user must change their password, cleared on
 * change and sign-out. Only a hint so proxy.ts can redirect without a DB
 * read; deleting it gains nothing because requireSession/requireRole check
 * the database flag.
 */
export const MUST_CHANGE_COOKIE = "hr.must_change_password";

/**
 * A same-origin path to return to after sign-in, or null. Rejects absolute
 * and protocol-relative URLs ("//evil", "/\\evil") so callbackUrl can't be
 * an open redirect.
 */
export function safeCallbackPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  // Control characters (incl. tab/newline, which browsers strip) are never valid here.
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) return null;
  return value;
}
