import { NextResponse, type NextRequest } from "next/server";
import { CHANGE_PASSWORD_PATH, LOGIN_PATH } from "@/auth/paths";
import {
  hasMustChangeHint,
  hasSessionCookie,
  MUST_CHANGE_COOKIE,
} from "@/auth/proxy-helpers";
import {
  buildSecurityHeaders,
  generateNonce,
  NONCE_HEADER,
} from "@/auth/security-headers";
import { env } from "@/env";

/**
 * 1. Security headers on every matched response, including a per-request
 *    nonce CSP (Next 16 CSP guide). The CSP also goes on the forwarded
 *    request, which is how Next.js finds the nonce for its own scripts;
 *    Server Components read it from `x-nonce` (getCspNonce()).
 *
 * 2. Optimistic redirects only (ADR-0004 rule 3). This is NOT the
 *    authorization boundary: every page, action and route handler calls
 *    requireSession/requireRole, which read the database. No DB access here.
 *    - No session cookie: GET/HEAD of a protected page -> /login?callbackUrl=…
 *    - Forced password change hint cookie: GET/HEAD of any page other than
 *      /change-password -> /change-password.
 *    - Non-GET requests (server actions) pass through; the action itself
 *      returns UNAUTHENTICATED/FORBIDDEN.
 *    - Sets x-hr-pathname so requireSession({ onFail: 'redirect' }) can
 *      build the callbackUrl. Client-sent values of x-hr-pathname, x-nonce
 *      and Content-Security-Policy are overwritten.
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

function securityHeaders(nonce: string): Record<string, string> {
  const isProduction = env.NODE_ENV === "production";
  const https = env.BETTER_AUTH_URL?.startsWith("https://") ?? false;
  return buildSecurityHeaders({
    nonce,
    isDev: env.NODE_ENV === "development",
    upgradeInsecureRequests: isProduction && https,
    hsts: isProduction && https,
  });
}

function withHeaders(
  response: NextResponse,
  headers: Record<string, string>,
): NextResponse {
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = generateNonce();
  const headers = securityHeaders(nonce);
  const isPageRequest = request.method === "GET" || request.method === "HEAD";
  const isApi = pathname.startsWith("/api/");

  if (isPageRequest && !isApi && !isPublic(pathname)) {
    if (!hasSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
      return withHeaders(NextResponse.redirect(url), headers);
    }
    if (
      pathname !== CHANGE_PASSWORD_PATH &&
      hasMustChangeHint(request.cookies.get(MUST_CHANGE_COOKIE)?.value)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = CHANGE_PASSWORD_PATH;
      url.search = "";
      return withHeaders(NextResponse.redirect(url), headers);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-hr-pathname", pathname + search);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(
    "Content-Security-Policy",
    headers["Content-Security-Policy"]!,
  );
  return withHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    headers,
  );
}

export const config = {
  matcher: [
    // Everything except Next internals and files with an extension (public/ assets).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
