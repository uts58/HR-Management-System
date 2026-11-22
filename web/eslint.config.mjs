import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import contractsImportsRule from "./eslint/rules/contracts-imports.mjs";
import serverActionsRule from "./eslint/rules/server-actions.mjs";

const DB_MESSAGE =
  "Database access is only allowed in src/server/**, src/auth/** and tests/integration/** (ADR-0002). Call a service from '@/server/<domain>/...' instead.";
const AUTH_MESSAGE =
  "better-auth may only be imported in src/auth/** (and src/app/api/auth/**). Use the helpers exported from '@/auth/...' (ADR-0002).";

const DB_IMPORT_REGEXES = [
  "^@prisma/client(/.*)?$",
  "^@prisma/adapter-[^/]+(/.*)?$",
  "^@/server/db(\\.ts)?$",
  "^(\\.{1,2}/)+(.*/)?server/db(\\.ts)?$",
  "^@/generated/prisma(/.*)?$",
  "^(\\.{1,2}/)+(.*/)?generated/prisma(/.*)?$",
];
const AUTH_IMPORT_REGEXES = ["^better-auth(/.*)?$", "^@better-auth/.+$"];

const toEsquery = (re) => re.replaceAll("/", "\\x2F");

function boundaryRules({ db, auth }) {
  const patterns = [];
  const syntax = [];
  const add = (regexes, message) => {
    for (const regex of regexes) {
      patterns.push({ regex, message });
      const es = toEsquery(regex);
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

  {
    plugins: {
      hr: {
        rules: {
          "server-actions": serverActionsRule,
          "contracts-imports": contractsImportsRule,
        },
      },
    },
    rules: { "hr/server-actions": "error" },
  },
  {
    files: ["src/contracts/**"],
    rules: { "hr/contracts-imports": "error" },
  },

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
