import { NextResponse, type NextRequest } from "next/server";
import { CHANGE_PASSWORD_PATH, LOGIN_PATH } from "@/auth/paths";
import {
  hasMustChangeHint,
  hasSessionCookie,
  MUST_CHANGE_COOKIE,
} from "@/auth/proxy-helpers";

/**
 * Optimistic redirects only (ADR-0004 rule 3). This is NOT the
 * authorization boundary: every page, action and route handler calls
 * requireSession/requireRole, which read the database. No DB access here.
 *
 * - No session cookie: GET/HEAD of a protected page -> /login?callbackUrl=…
 * - Forced password change hint cookie: GET/HEAD of any page other than
 *   /change-password -> /change-password.
 * - Non-GET requests (server actions) pass through; the action itself
 *   returns UNAUTHENTICATED/FORBIDDEN.
 * - Sets x-hr-pathname so requireSession({ onFail: 'redirect' }) can build
 *   the callbackUrl. Any client-sent value is overwritten.
 */

const PUBLIC_PATHS = [LOGIN_PATH];
const PUBLIC_PREFIXES = ["/api/auth/", "/api/health"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some(
      (p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p),
    )
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPageRequest = request.method === "GET" || request.method === "HEAD";
  const isApi = pathname.startsWith("/api/");

  if (isPageRequest && !isApi && !isPublic(pathname)) {
    if (!hasSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    if (
      pathname !== CHANGE_PASSWORD_PATH &&
      hasMustChangeHint(request.cookies.get(MUST_CHANGE_COOKIE)?.value)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = CHANGE_PASSWORD_PATH;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-hr-pathname", pathname + search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Everything except Next internals and files with an extension (public/ assets).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
