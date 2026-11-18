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
