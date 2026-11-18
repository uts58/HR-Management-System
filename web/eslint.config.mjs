import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import serverActionsRule from "./eslint/rules/server-actions.mjs";

// ---------------------------------------------------------------------------
// Import boundaries (ADR-0002). Owned by Platform. An `eslint-disable` of
// these rules needs review from the owner of the affected path. CI runs ESLint
// with --report-unused-disable-directives.
//
//   Database (Prisma packages, @/server/db, generated client):
//     allowed in src/server/**, src/auth/**, tests/integration/**, prisma/**
//   better-auth / @better-auth/*:
//     allowed in src/auth/** and src/app/api/auth/** only
// ---------------------------------------------------------------------------

const DB_MESSAGE =
  "Database access is only allowed in src/server/**, src/auth/** and tests/integration/** (ADR-0002). Call a service from '@/server/<domain>/...' instead.";
const AUTH_MESSAGE =
  "better-auth may only be imported in src/auth/** (and src/app/api/auth/**). Use the helpers exported from '@/auth/...' (ADR-0002).";

// Regexes are matched against the import specifier and cover alias,
// relative and package forms.
const DB_IMPORT_REGEXES = [
  "^@prisma/client(/.*)?$",
  "^@prisma/adapter-[^/]+(/.*)?$",
  "^@/server/db(\\.ts)?$",
  "^(\\.{1,2}/)+(.*/)?server/db(\\.ts)?$",
  "^@/generated/prisma(/.*)?$",
  "^(\\.{1,2}/)+(.*/)?generated/prisma(/.*)?$",
];
const AUTH_IMPORT_REGEXES = ["^better-auth(/.*)?$", "^@better-auth/.+$"];

// esquery regex literals end at the first "/", so write "/" as \x2F.
const toEsquery = (re) => re.replaceAll("/", "\\x2F");

/**
 * Build the restriction rules for one zone. Flat config replaces rule
 * options instead of merging them, so each zone gets a complete config.
 * @param {{ db: boolean, auth: boolean }} restrict
 */
function boundaryRules({ db, auth }) {
  const patterns = [];
  const syntax = [];
  const add = (regexes, message) => {
    for (const regex of regexes) {
      patterns.push({ regex, message });
      const es = toEsquery(regex);
      // Dynamic import("...") and require("...") are invisible to
      // no-restricted-imports.
      syntax.push(
        { selector: `ImportExpression[source.value=/${es}/]`, message },
        {
          selector: `CallExpression[callee.name='require'][arguments.0.value=/${es}/]`,
          message,
        },
      );
    }
  };
  if (db) add(DB_IMPORT_REGEXES, DB_MESSAGE);
  if (auth) add(AUTH_IMPORT_REGEXES, AUTH_MESSAGE);

  return {
    "no-restricted-imports":
      patterns.length > 0 ? ["error", { patterns }] : "off",
    "no-restricted-syntax": syntax.length > 0 ? ["error", ...syntax] : "off",
  };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Local rules.
  {
    plugins: { hr: { rules: { "server-actions": serverActionsRule } } },
    rules: { "hr/server-actions": "error" },
  },

  // Boundary zones: the default comes first, and later entries override it.
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}"],
    rules: boundaryRules({ db: true, auth: true }),
  },
  { files: ["src/server/**"], rules: boundaryRules({ db: false, auth: true }) },
  { files: ["src/auth/**"], rules: boundaryRules({ db: false, auth: false }) },
  {
    files: ["src/app/api/auth/**"],
    rules: boundaryRules({ db: true, auth: false }),
  },
  {
    files: ["tests/integration/**"],
    rules: boundaryRules({ db: false, auth: true }),
  },
  { files: ["prisma/**"], rules: boundaryRules({ db: false, auth: true }) },

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
