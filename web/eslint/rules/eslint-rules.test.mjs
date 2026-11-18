// Tests for Platform-owned lint tooling: the local server-actions rule and
// the import-boundary configuration in eslint.config.mjs.
import path from "node:path";
import { ESLint, RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";
import rule from "./server-actions.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: "latest",
    sourceType: "module",
  },
});

const imp = 'import { defineAction } from "@/lib/action";\n';

ruleTester.run("hr/server-actions", rule, {
  valid: [
    {
      code: `"use server";\n${imp}export const createX = defineAction({ role: "HR", schema, handler });`,
    },
    {
      code: `"use server";\nimport { defineAction } from "@/server/action";\nexport const a = defineAction({}), b = defineAction({});`,
    },
    {
      code: `"use server";\n${imp}export type Input = { id: string };\nexport interface Out { ok: boolean }\nexport type { Foo } from "./foo";\nexport const a = defineAction({});`,
    },
    // Not a 'use server' file: anything goes (except inline directives).
    { code: `export function helper() { return 1; }` },
    // 'use server' that is not the leading directive does not count.
    { code: `"use client";\nexport function f() {}` },
  ],
  invalid: [
    {
      code: `"use server";\nexport async function createX() {}`,
      errors: [{ messageId: "forbiddenExportForm" }],
    },
    {
      code: `"use server";\nexport const createX = async () => {};`,
      errors: [{ messageId: "notDefineAction" }],
    },
    {
      code: `"use server";\n${imp}export let createX = defineAction({});`,
      errors: [{ messageId: "forbiddenExportForm" }],
    },
    {
      code: `"use server";\n${imp}const x = defineAction({});\nexport { x };`,
      errors: [{ messageId: "forbiddenExportForm" }],
    },
    {
      code: `"use server";\nexport { createX } from "./impl";`,
      errors: [{ messageId: "forbiddenExportForm" }],
    },
    {
      code: `"use server";\nexport * from "./impl";`,
      errors: [{ messageId: "forbiddenExportForm" }],
    },
    {
      code: `"use server";\n${imp}export default defineAction({});`,
      errors: [{ messageId: "forbiddenExportForm" }],
    },
    {
      code: `"use server";\n${imp}export const x = defineAction({}) as unknown as Foo;`,
      errors: [{ messageId: "notDefineAction" }],
    },
    {
      code: `"use server";\n${imp}export const x = wrap(defineAction({}));`,
      errors: [{ messageId: "notDefineAction" }],
    },
    {
      // Locally defined lookalike.
      code: `"use server";\nconst defineAction = (c) => c;\nexport const x = defineAction({});`,
      errors: [{ messageId: "defineActionNotImported" }],
    },
    {
      code: `"use server";\nimport { defineAction } from "./my-own";\nexport const x = defineAction({});`,
      errors: [{ messageId: "defineActionNotImported" }],
    },
    {
      code: `"use server";\nimport { other as defineAction } from "@/lib/action";\nexport const x = defineAction({});`,
      errors: [{ messageId: "defineActionNotImported" }],
    },
    {
      code: `export default function Page() {\n  async function save() { "use server"; }\n  return save;\n}`,
      errors: [{ messageId: "inlineUseServer" }],
    },
    {
      code: `export const f = async () => { "use server"; };`,
      errors: [{ messageId: "inlineUseServer" }],
    },
  ],
});

// ---------------------------------------------------------------------------
// Import boundaries, exercised through the real eslint.config.mjs.
// ---------------------------------------------------------------------------
const webRoot = path.resolve(import.meta.dirname, "..", "..");
const eslint = new ESLint({ cwd: webRoot });

async function boundaryErrors(file, code) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(webRoot, file),
  });
  return result.messages
    .filter((m) =>
      ["no-restricted-imports", "no-restricted-syntax"].includes(m.ruleId),
    )
    .map((m) => m.ruleId);
}

const DB_IMPORTS = [
  'import { PrismaClient } from "@prisma/client";',
  'import { PrismaPg } from "@prisma/adapter-pg";',
  'import { db } from "@/server/db";',
  'import { db } from "../../server/db";',
  'import { Prisma } from "@/generated/prisma/client";',
  'import { Prisma } from "../generated/prisma/client";',
];
const AUTH_IMPORTS = [
  'import { betterAuth } from "better-auth";',
  'import { toNextJsHandler } from "better-auth/next-js";',
  'import { prismaAdapter } from "@better-auth/prisma-adapter";',
];

describe("import boundaries", () => {
  const cases = [
    // file, allowDb, allowAuth
    ["src/app/employees/page.tsx", false, false],
    ["src/components/thing.tsx", false, false],
    ["src/lib/validation/employee.ts", false, false],
    ["src/server/employee/service.ts", true, false],
    ["src/auth/config.ts", true, true],
    ["src/app/api/auth/[...all]/route.ts", false, true],
    ["tests/integration/employee.test.ts", true, false],
    ["tests/e2e/login.spec.ts", false, false],
    ["prisma/seed.ts", true, false],
  ];

  for (const [file, allowDb, allowAuth] of cases) {
    it(`${file}: db ${allowDb ? "allowed" : "blocked"}, better-auth ${allowAuth ? "allowed" : "blocked"}`, async () => {
      for (const code of DB_IMPORTS) {
        const errs = await boundaryErrors(file, `${code}\nexport {};\n`);
        expect(errs.length > 0, `${file} :: ${code}`).toBe(!allowDb);
      }
      for (const code of AUTH_IMPORTS) {
        const errs = await boundaryErrors(file, `${code}\nexport {};\n`);
        expect(errs.length > 0, `${file} :: ${code}`).toBe(!allowAuth);
      }
    });
  }

  it("catches dynamic import() and require()", async () => {
    const file = "src/app/x/page.tsx";
    expect(
      await boundaryErrors(
        file,
        'export const m = () => import("@/server/db");',
      ),
    ).toContain("no-restricted-syntax");
    expect(
      await boundaryErrors(
        file,
        'export const m = () => import("better-auth/react");',
      ),
    ).toContain("no-restricted-syntax");
    expect(
      await boundaryErrors(file, 'export const m = require("@prisma/client");'),
    ).toContain("no-restricted-syntax");
  });

  it("does not flag look-alike modules", async () => {
    const file = "src/app/x/page.tsx";
    expect(
      await boundaryErrors(
        file,
        'import { a } from "@/server/employee/service";\nimport { b } from "@/server/dbx";\nexport { a, b };',
      ),
    ).toEqual([]);
  });
});
