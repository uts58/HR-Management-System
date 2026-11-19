import { describe, expect, it } from "vitest";

describe("server-only alias", () => {
  it("lets tests import modules that start with `import 'server-only'`", async () => {
    // Without the alias, the real package throws on import outside RSC.
    await expect(import("server-only")).resolves.toBeDefined();
  });
});
