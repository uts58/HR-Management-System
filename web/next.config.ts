import path from "node:path";
import type { NextConfig } from "next";

// web/ sits inside the legacy repo, which has its own package-lock.json at
// the root. Pin the project root so Next does not treat the repo root as a
// workspace root.
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // Self-hosted with Docker. Emits .next/standalone/server.js (see web/Dockerfile).
  output: "standalone",
  outputFileTracingRoot: projectRoot,

  // OFF by director ruling: nearly every page is per-user (session-scoped HR
  // data), so caching by default would cost more than it gains. Opt in per
  // route with care. create-next-app 16.4 enables this (and
  // partialPrefetching, which depends on it) by default.
  cacheComponents: false,

  // Native and driver packages are loaded from node_modules at runtime,
  // not bundled.
  serverExternalPackages: ["@node-rs/argon2", "pg"],

  poweredByHeader: false,

  // Static assets don't pass through proxy.ts, so they miss Security's
  // headers there. Add nosniff here so it is set even when Next.js is
  // reached without Caddy. CSP and the other headers stay in proxy.ts
  // (Security) and the Caddyfile. Don't duplicate them here.
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },

  // Next blocks /_next/hmr from 127.0.0.1 by default, so pages never hydrate
  // in local e2e runs against the dev server.
  allowedDevOrigins: ["127.0.0.1"],

  turbopack: {
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
