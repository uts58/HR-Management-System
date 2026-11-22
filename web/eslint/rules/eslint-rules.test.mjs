// Tests for the lint tooling: the local server-actions rule and
// the import-boundary configuration in eslint.config.mjs.
import path from "node:path";
import { ESLint, RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";
import contractsRule from "./contracts-imports.mjs";
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

const imp = 'import { defineAction } from "@/server/action";\n';

ruleTester.run("hr/server-actions", rule, {
  valid: [
    {
      code: `"use server";\n${imp}export const createX = defineAction({ role: "HR", schema, handler });`,
    },
    {
      code: `"use server";\nimport { defineAction } from "@/server/action";\nexport const a = defineAction({ role: "HR_ADMIN" }), b = defineAction({ role: "HR_ADMIN" });`,
    },
    {
      code: `"use server";\n${imp}export type Input = { id: string };\nexport interface Out { ok: boolean }\nexport type { Foo } from "./foo";\nexport const a = defineAction({ role: "HR_ADMIN" });`,
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
      code: `"use server";\n${imp}export let createX = defineAction({ role: "HR_ADMIN" });`,
      errors: [{ messageId: "forbiddenExportForm" }],
    },
    {
      code: `"use server";\n${imp}const x = defineAction({ role: "HR_ADMIN" });\nexport { x };`,
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
      code: `"use server";\n${imp}export default defineAction({ role: "HR_ADMIN" });`,
      errors: [{ messageId: "forbiddenExportForm" }],
    },
    {
      code: `"use server";\n${imp}export const x = defineAction({ role: "HR_ADMIN" }) as unknown as Foo;`,
      errors: [{ messageId: "notDefineAction" }],
    },
    {
      code: `"use server";\n${imp}export const x = wrap(defineAction({ role: "HR_ADMIN" }));`,
      errors: [{ messageId: "notDefineAction" }],
    },
    {
      // Locally defined lookalike.
      code: `"use server";\nconst defineAction = (c) => c;\nexport const x = defineAction({ role: "HR_ADMIN" });`,
      errors: [{ messageId: "defineActionNotImported" }],
    },
    {
      code: `"use server";\nimport { defineAction } from "./my-own";\nexport const x = defineAction({ role: "HR_ADMIN" });`,
      errors: [{ messageId: "defineActionNotImported" }],
    },
    {
      // Only @/server/action is allowed (ADR-0002), not lib/.
      code: `"use server";\nimport { defineAction } from "@/lib/action";\nexport const x = defineAction({ role: "HR_ADMIN" });`,
      errors: [{ messageId: "defineActionNotImported" }],
    },
    {
      code: `"use server";\nimport { other as defineAction } from "@/server/action";\nexport const x = defineAction({ role: "HR_ADMIN" });`,
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

// --- defineAction role checks (PUBLIC only in src/auth) --------------------
const srcRoot = path.resolve(import.meta.dirname, "..", "..", "src");
const authActions = path.join(srcRoot, "auth", "actions.ts");
const appActions = path.join(srcRoot, "app", "employees", "actions.ts");
const action = (role, filename = appActions) => ({
  code: `"use server";\n${imp}export const a = defineAction({ ${role} schema, handler });`,
  filename,
});

ruleTester.run("hr/server-actions (roles)", rule, {
  valid: [
    action('role: "HR_ADMIN",'),
    action("role: Role.EMPLOYEE,"),
    action('role: ["HR_ADMIN", Role.EMPLOYEE],'),
    action('role: "ANY", allowPendingPasswordChange: true,'),
    action('role: "PUBLIC",', authActions),
    action("role: `PUBLIC`,", authActions),
    // Inside src/auth, nested folders count too.
    action('role: "PUBLIC",', path.join(srcRoot, "auth", "sign-in", "a.ts")),
  ],
  invalid: [
    ['role: "PUBLIC",', "publicOutsideAuth"],
    ["role: `PUBLIC`,", "publicOutsideAuth"],
    ['role: ["HR_ADMIN", "PUBLIC"],', "publicOutsideAuth"],
    ["role: Roles.PUBLIC,", "publicOutsideAuth"],
    ['role: "PUBLIC" as const,', "publicOutsideAuth"],
    ["role: someVar,", "roleNotStatic"],
    ["role,", "roleNotStatic"],
    ["role: [...roles],", "roleNotStatic"],
    ["", "missingRole"],
  ]
    .map(([role, messageId]) => ({ ...action(role), errors: [{ messageId }] }))
    .concat([
      {
        code: `"use server";\n${imp}const cfg = { role: "PUBLIC" };\nexport const a = defineAction(cfg);`,
        filename: appActions,
        errors: [{ messageId: "configNotInline" }],
      },
      {
        code: `"use server";\n${imp}export const a = defineAction({ ...base, role: "HR_ADMIN" });`,
        filename: appActions,
        errors: [{ messageId: "configNotInline" }],
      },
      {
        // Also checked outside 'use server' files.
        code: `${imp}const a = defineAction({ role: "PUBLIC", schema, handler });`,
        filename: path.join(srcRoot, "server", "x.ts"),
        errors: [{ messageId: "publicOutsideAuth" }],
      },
      {
        // A look-alike directory name is not src/auth.
        ...action('role: "PUBLIC",', path.join(srcRoot, "authz", "a.ts")),
        errors: [{ messageId: "publicOutsideAuth" }],
      },
    ]),
});

// ---------------------------------------------------------------------------
// hr/contracts-imports
// ---------------------------------------------------------------------------
// RuleTester needs absolute filenames (they need not exist).
const srcDir = path.resolve(import.meta.dirname, "..", "..", "src");
const contractFile = path.join(srcDir, "contracts", "leave.ts");
const nestedContractFile = path.join(srcDir, "contracts", "sub", "x.ts");
const libFile = path.join(srcDir, "lib", "x.ts");
const c = (code, filename = contractFile) => ({ code, filename });

ruleTester.run("hr/contracts-imports", contractsRule, {
  valid: [
    c('import type { Actor, IsoDate } from "./common";'),
    c('import type { Role } from "@/contracts/auth";'),
    c('import type { A } from "../common";', nestedContractFile),
    c('export * from "./common";\nexport { Role } from "./auth";'),
    c('export const LEAVE_TYPES = ["SICK"] as const;'),
    c('export type T = import("./common").Actor;'),
    // Rule is inert outside src/contracts (config also scopes it).
    c('import { z } from "zod";', libFile),
  ],
  invalid: [
    c('import { Actor } from "./common";'),
    c('import { type Actor } from "./common";'),
    c('import type { z } from "zod";'),
    c('import type { Db } from "@/server/db";'),
    c('import type { X } from "../lib/x";'),
    c('import type { X } from "../../contracts-evil/x";'),
    c('import "./common";'),
    c('export * from "../server/types";'),
    c('export { x } from "zod";'),
    c('export type T = import("zod").ZodType;'),
    c('export const m = () => import("./common");'),
    c('const x = require("./common");'),
  ].map((t, i) => ({
    ...t,
    errors: [
      {
        messageId: [
          "notTypeOnly",
          "notTypeOnly",
          "outsideContracts",
          "outsideContracts",
          "outsideContracts",
          "outsideContracts",
          "sideEffect",
          "outsideContracts",
          "outsideContracts",
          "outsideContracts",
          "dynamic",
          "dynamic",
        ][i],
      },
    ],
  })),
});

describe("contracts rule is wired to src/contracts in eslint.config.mjs", () => {
  it("flags a value import from outside contracts", async () => {
    const [result] = await eslint.lintText(
      'import { z } from "zod";\nexport const s = z;\n',
      { filePath: path.join(webRoot, "src/contracts/new.ts") },
    );
    expect(result.messages.map((m) => m.ruleId)).toContain(
      "hr/contracts-imports",
    );
  });
  it("accepts the real contract files", async () => {
    const results = await eslint.lintFiles(["src/contracts/**/*.ts"]);
    const msgs = results.flatMap((r) =>
      r.messages.filter((m) => m.ruleId === "hr/contracts-imports"),
    );
    expect(msgs).toEqual([]);
  });
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
