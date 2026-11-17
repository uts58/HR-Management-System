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

  // Scaffold defaults from create-next-app 16.4
  cacheComponents: true,
  partialPrefetching: true,

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
