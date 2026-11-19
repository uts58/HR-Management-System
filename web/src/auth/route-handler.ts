import "server-only";

import { toNextJsHandler } from "better-auth/next-js";
import { ALLOWED_AUTH_PATHS, getAuth } from "./config";

const BASE = "/api/auth";
const allowed = new Set<string>(ALLOWED_AUTH_PATHS);

/**
 * Better Auth's HTTP handler behind an allowlist. Only the endpoints we use
 * are reachable; everything else is a 404 even if a future Better Auth
 * version adds endpoints that `disabledPaths` doesn't know about.
 */
async function guarded(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const sub = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : null;
  const normalised = sub?.replace(/\/+$/, "") || "/";
  if (sub === null || !allowed.has(normalised)) {
    return new Response("Not Found", { status: 404 });
  }
  return getAuth().handler(request);
}

export const authRouteHandlers = toNextJsHandler(guarded);

/** Exported for tests. */
export { guarded as handleAuthRequest };
