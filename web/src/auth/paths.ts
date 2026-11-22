export const LOGIN_PATH = "/login";
export const CHANGE_PASSWORD_PATH = "/change-password";
export const DASHBOARD_PATH = "/dashboard";
export const FORBIDDEN_PATH = "/forbidden";

export const MUST_CHANGE_COOKIE = "hr.must_change_password";

export function safeCallbackPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) return null;
  return value;
}
