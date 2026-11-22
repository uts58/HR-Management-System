import path from "node:path";
import type { NextConfig } from "next";

const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,

  cacheComponents: false,

  serverExternalPackages: ["@node-rs/argon2", "pg"],

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },

  // Next blocks /_next/hmr from 127.0.0.1 by default, so pages never hydrate.
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
