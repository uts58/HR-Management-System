import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Only the server layer (src/server/**) and the Prisma folder (prisma/**,
// i.e. seed scripts) may touch the database client. Everything else goes
// through src/server.
const prismaImportRestriction = {
  paths: [
    {
      name: "@prisma/client",
      message:
        "Import database access from '@/server/...' instead. Prisma is only allowed in src/server/** and prisma/**.",
    },
  ],
  patterns: [
    {
      group: [
        "@prisma/client/*",
        "@prisma/adapter-*",
        "@/generated/prisma",
        "@/generated/prisma/*",
        "**/generated/prisma",
        "**/generated/prisma/*",
      ],
      message:
        "Import database access from '@/server/...' instead. The Prisma client is only allowed in src/server/** and prisma/**.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": ["error", prismaImportRestriction],
    },
  },
  {
    // Allowed to import Prisma.
    files: ["src/server/**/*.{ts,tsx}", "prisma/**/*.{ts,mts,js,mjs}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Must come last: turns off stylistic rules that conflict with Prettier.
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
