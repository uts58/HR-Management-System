import { BACKEND_TAG } from "../support/env";
import { expect, test } from "../support/fixtures";
import type { App } from "../support/fixtures";
import { expectFieldError } from "../support/pages/common";
import type { OrgUnitPage } from "../support/pages/hr";
import { uid } from "../support/users";

/** Feature map rows 15–20 (legacy /hr/addDep, saveDep, deleteDep and the position equivalents). */

const kinds: {
  name: string;
  page: (a: App) => OrgUnitPage;
  select: "Department" | "Position";
  inUse: string;
}[] = [
  {
    name: "Departments",
    page: (a) => a.departments,
    select: "Department",
    inUse: "Engineering",
  },
  {
    name: "Positions",
    page: (a) => a.positions,
    select: "Position",
    inUse: "Software Engineer",
  },
];

for (const kind of kinds) {
  test.describe(kind.name, () => {
    test("a blank name is rejected", async ({ hr }) => {
      const p = kind.page(hr);
      await hr.page.goto("/dashboard");
      await p.open();
      await p.add("   ");
      await expectFieldError(p.nameInput(), "Name is required");
    });

    test.describe("journeys", { tag: BACKEND_TAG }, () => {
      test("HR adds one: toast, listed, offered on the employee form", async ({
        hr,
      }) => {
        const name = uid(`QA ${kind.select}`);
        const p = kind.page(hr);
        await hr.page.goto("/dashboard");
        await p.open();
        await p.add(name);
        await p.expectAdded();
        await expect(p.row(name)).toContainText("0");

        await hr.page.goto("/employees/new");
        await expect(
          hr.employees
            .form("Add employee")
            .getByLabel(kind.select)
            .locator("option", { hasText: name }),
        ).toHaveCount(1);
      });

      test("a duplicate name is rejected, ignoring case", async ({ hr }) => {
        const p = kind.page(hr);
        await hr.page.goto("/dashboard");
        await p.open();
        await p.add(kind.inUse.toUpperCase());
        await expectFieldError(p.nameInput(), /already|exists|taken|unique/i);
      });

      test("HR deletes an unused one after confirming", async ({ hr }) => {
        const name = uid(`QA del ${kind.select}`);
        const p = kind.page(hr);
        await hr.page.goto("/dashboard");
        await p.open();
        await p.add(name);
        await p.expectAdded();
        await p.delete(name);
        await expect(
          hr.page
            .locator("[data-sonner-toaster]")
            .getByText(`${kind.select} deleted.`),
        ).toBeVisible();
        await expect(p.row(name)).toHaveCount(0);
      });

      test("one that employees use cannot be deleted", async ({ hr }) => {
        const p = kind.page(hr);
        await hr.page.goto("/dashboard");
        await p.open();
        const row = p.row(kind.inUse);
        await expect(row).toContainText("In use, can't delete");
        await expect(p.deleteButton(kind.inUse)).toHaveCount(0);
      });
    });
  });
}
