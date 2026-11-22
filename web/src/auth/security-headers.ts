export const NONCE_HEADER = "x-nonce";

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export interface CspOptions {
  nonce: string;
  isDev: boolean;
  upgradeInsecureRequests: boolean;
}

export function buildCsp({
  nonce,
  isDev,
  upgradeInsecureRequests,
}: CspOptions): string {
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
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
  hsts: boolean;
}

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
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }
  return headers;
}
