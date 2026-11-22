import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: [
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
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
