import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Two projects:
//  - unit:        fast, no DB. Co-located src/**/*.test.ts(x) and tests/unit/**.
//                 Default environment is node. For component tests add
//                 `// @vitest-environment jsdom` at the top of the file.
//  - integration: tests/integration/**. Needs a real Postgres (DATABASE_URL).
//                 CI runs it against a service container after
//                 `prisma migrate deploy`.
// `npm test` runs unit only. `npm run test:integration` runs integration.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolves the "@/*" alias from tsconfig.json.
    tsconfigPaths: true,
    alias: [
      // `import "server-only"` throws outside an RSC build. Map it to an
      // empty module so tests can import src/server and src/auth files.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(
          new URL("./vitest/server-only-stub.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    passWithNoTests: true,
    env: {
      SKIP_ENV_VALIDATION: "1",
      // Deterministic dates, same as Docker and CI.
      TZ: "UTC",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "src/**/*.{test,spec}.{ts,tsx}",
            "tests/unit/**/*.{test,spec}.{ts,tsx}",
            // Platform lint tooling tests (local rules + import boundaries)
            "eslint/**/*.test.mjs",
            "vitest/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.{test,spec}.{ts,tsx}"],
          // DB tests share one database. Run files serially to avoid cross-test interference.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
