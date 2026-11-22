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
  matcher: ["/((?!_next/static/|_next/image|favicon\\.ico$|images/|fonts/).*)"],
};
