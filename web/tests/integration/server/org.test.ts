import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { orgService } from "@/server/org/service";
import {
  isForeignKeyViolation,
  uniqueViolationToConflict,
} from "@/server/errors";
import {
  db,
  makeDepartment,
  makeEmployee,
  makePerson,
  makePosition,
  rejection,
  resetDatabase,
} from "./helpers";

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

async function actors() {
  const hr = (await makePerson("HR_ADMIN")).actor;
  const emp = (await makePerson("EMPLOYEE")).actor;
  return { hr, emp };
}

describe("orgService", () => {
  it("creates and lists departments with active/total counts", async () => {
    const { hr } = await actors();
    const d = await orgService.createDepartment(hr, { name: "  Finance " });
    expect(d).toEqual({
      id: d.id,
      name: "Finance",
      employeeCount: 0,
      totalEmployeeCount: 0,
    });
    await makeEmployee({ departmentId: d.id });
    await makeEmployee({
      departmentId: d.id,
      employmentStatus: "TERMINATED",
      terminatedAt: new Date(),
    });
    const list = await orgService.listDepartments(hr);
    expect(list).toEqual([
      { id: d.id, name: "Finance", employeeCount: 1, totalEmployeeCount: 2 },
    ]);
  });

  it("rejects duplicate names case-insensitively with CONFLICT on name", async () => {
    const { hr } = await actors();
    await orgService.createDepartment(hr, { name: "Finance" });
    const e = await rejection(
      orgService.createDepartment(hr, { name: "FINANCE" }),
    );
    expect(e).toMatchObject({
      code: "CONFLICT",
      fieldErrors: { name: ["A department with this name already exists"] },
    });
    await expect(
      orgService.createPosition(hr, { name: "finance" }),
    ).resolves.toMatchObject({ name: "finance" });
  });

  it("maps the real lower(name) index violation (insert race) to CONFLICT on name", async () => {
    await makePosition("Analyst");
    const raw = await rejection(
      db.position.create({ data: { name: "ANALYST" } }),
    );
    expect(uniqueViolationToConflict(raw)).toMatchObject({
      code: "CONFLICT",
      message: "A position with this name already exists",
      fieldErrors: { name: ["A position with this name already exists"] },
    });
  });

  it("refuses to delete a department in use, counting terminated employees", async () => {
    const { hr } = await actors();
    const d = await makeDepartment("Ops");
    await makeEmployee({
      departmentId: d.id,
      employmentStatus: "TERMINATED",
      terminatedAt: new Date(),
    });
    const e = await rejection(orgService.deleteDepartment(hr, d.id));
    expect(e).toMatchObject({
      code: "CONFLICT",
      message:
        "1 employee is assigned to this department. Reassign them first.",
    });
    await makeEmployee({ departmentId: d.id });
    expect(
      (await rejection(orgService.deleteDepartment(hr, d.id))).message,
    ).toBe("2 employees are assigned to this department. Reassign them first.");
  });

  it("the real P2003 from a racing delete is recognised", async () => {
    const d = await makeDepartment("Race");
    await makeEmployee({ departmentId: d.id });
    const raw = await rejection(db.department.delete({ where: { id: d.id } }));
    expect(isForeignKeyViolation(raw)).toBe(true);
  });

  it("deletes an unused department and position; unknown ids are NOT_FOUND", async () => {
    const { hr } = await actors();
    const d = await makeDepartment("Temp");
    const p = await makePosition("Temp");
    await orgService.deleteDepartment(hr, d.id);
    await orgService.deletePosition(hr, p.id);
    expect(await orgService.listDepartments(hr)).toEqual([]);
    expect((await rejection(orgService.deleteDepartment(hr, d.id))).code).toBe(
      "NOT_FOUND",
    );
  });

  it("is HR-only (service-level second gate)", async () => {
    const { emp } = await actors();
    for (const call of [
      () => orgService.listDepartments(emp),
      () => orgService.listPositions(emp),
      () => orgService.createDepartment(emp, { name: "X" }),
      () => orgService.deletePosition(emp, 1),
    ]) {
      expect((await rejection(call())).code).toBe("FORBIDDEN");
    }
  });

  it("validates input (VALIDATION via ZodError)", async () => {
    const { hr } = await actors();
    const e = await rejection(orgService.createDepartment(hr, { name: " " }));
    expect(e.name).toBe("ZodError");
  });
});
