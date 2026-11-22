import { describe, expect, it } from "vitest";

describe("server-only alias", () => {
  it("lets tests import modules that start with `import 'server-only'`", async () => {
    await expect(import("server-only")).resolves.toBeDefined();
  });
});
