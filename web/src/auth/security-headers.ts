/**
 * Security response headers for every request proxy.ts handles, following
 * Next 16's "Content Security Policy" guide (nonce set in Proxy; Next.js
 * reads the nonce from the request's CSP header and adds it to its own
 * scripts). No server-only import: proxy.ts loads this.
 */

/** Request header carrying the nonce to Server Components (read with getCspNonce()). */
export const NONCE_HEADER = "x-nonce";

/** 128 random bits, base64. Fresh for every request. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export interface CspOptions {
  nonce: string;
  /** `next dev` needs 'unsafe-eval' (React debugging). Never in production. */
  isDev: boolean;
  /** Add upgrade-insecure-requests (only when served over https). */
  upgradeInsecureRequests: boolean;
}

export function buildCsp({
  nonce,
  isDev,
  upgradeInsecureRequests,
}: CspOptions): string {
  const directives: string[] = [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by nonce'd scripts are trusted, so
    // Next's chunk loading works; host allowlists are ignored by CSP3
    // browsers. 'self' is the fallback for browsers without strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Styles: 'unsafe-inline' (no nonce here: a nonce would make browsers
    // ignore 'unsafe-inline'). sonner injects a <style> element at runtime
    // without a nonce, and React/shadcn use inline style attributes, which
    // can't carry a nonce. Script execution stays nonce-only.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (upgradeInsecureRequests) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export interface SecurityHeaderOptions extends CspOptions {
  /** Send HSTS. Production only (and Caddy sends the same value). */
  hsts: boolean;
}

/** All response headers, CSP included. */
export function buildSecurityHeaders(
  opts: SecurityHeaderOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildCsp(opts),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (opts.hsts) {
    // Same value as docker/caddy/Caddyfile, so either source is consistent.
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }
  return headers;
}
