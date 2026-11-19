import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { IsoDate } from "@/contracts/common";
import {
  createEmployeeService,
  employeeService as productionEmployeeService,
  usernameBase,
} from "@/server/employee/service";
import { leaveService } from "@/server/leave/service";
import {
  db,
  fakeAccountAdmin,
  makeDepartment,
  makeEmployee,
  makePerson,
  makePlaceholder,
  makePosition,
  makeUser,
  rejection,
  resetDatabase,
} from "./helpers";

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

async function setup() {
  const accounts = fakeAccountAdmin();
  const service = createEmployeeService(accounts.api);
  const hr = await makePerson("HR_ADMIN", {
    firstName: "Hr",
    lastName: "Admin",
  });
  const emp = await makePerson("EMPLOYEE", {
    firstName: "Emp",
    lastName: "One",
  });
  const dept = await makeDepartment("Engineering");
  const pos = await makePosition("Developer");
  const form = {
    firstName: "José",
    middleName: "",
    lastName: "Ñúñez",
    departmentId: String(dept.id),
    positionId: String(pos.id),
    country: "Germany",
    homeTown: "Berlin",
    contactNo: "+49 30 1234567",
    email: "Jose@Example.com",
    gender: "MALE",
    maritalStatus: "SINGLE",
    dateOfBirth: "1990-05-01",
  };
  return { accounts, service, hr, emp, dept, pos, form };
}

describe("usernameBase", () => {
  it.each([
    ["José", "Ñúñez", "jose.nunez"],
    ["Al", "", "al.user"],
    ["", "", "user"],
    ["Mary-Jane", "O'Neil", "maryjane.oneil"],
    ["A".repeat(40), "B", "a".repeat(27)],
  ])("%j %j -> %s", (first, last, expected) => {
    expect(usernameBase(first, last)).toBe(expected);
  });
});

describe("employeeService.createEmployee", () => {
  it("creates an ACTIVE employee and its login account in one transaction", async () => {
    const { service, hr, form, accounts } = await setup();
    const result = await service.createEmployee(hr.actor, form as never);
    expect(result.credentials).toEqual({
      username: "jose.nunez",
      temporaryPassword: "Temp-Password-123",
    });
    expect(result.employee).toMatchObject({
      firstName: "José",
      middleName: null,
      email: "jose@example.com",
      dateOfBirth: "1990-05-01",
      username: "jose.nunez",
      status: "ACTIVE",
      emailIsPlaceholder: false,
      department: { label: "Engineering" },
    });
    expect(result.employee.createdAt).toMatch(/Z$/);
    expect(accounts.calls).toEqual(["create:jose.nunez"]);
  });

  it("adds 2, 3… when the default username is taken", async () => {
    const { service, hr, form } = await setup();
    await makeUser(null, "EMPLOYEE", "jose.nunez");
    const a = await service.createEmployee(hr.actor, form as never);
    const b = await service.createEmployee(hr.actor, form as never);
    expect([a.credentials.username, b.credentials.username]).toEqual([
      "jose.nunez2",
      "jose.nunez3",
    ]);
  });

  it("an explicit username that is taken is CONFLICT on username", async () => {
    const { service, hr, form } = await setup();
    await makeUser(null, "EMPLOYEE", "taken.name");
    const e = await rejection(
      service.createEmployee(hr.actor, {
        ...form,
        username: "Taken.Name",
      } as never),
    );
    expect(e).toMatchObject({
      code: "CONFLICT",
      fieldErrors: { username: ["This username is already taken"] },
    });
  });

  it("unknown department/position is VALIDATION on those fields; nothing is written", async () => {
    const { service, hr, form } = await setup();
    const before = await db.employee.count();
    const e = await rejection(
      service.createEmployee(hr.actor, {
        ...form,
        departmentId: "999",
        positionId: "998",
      } as never),
    );
    expect(e).toMatchObject({
      code: "VALIDATION",
      fieldErrors: {
        departmentId: ["Select an existing department"],
        positionId: ["Select an existing position"],
      },
    });
    expect(await db.employee.count()).toBe(before);
  });

  it("rolls back the employee when the account step fails (fail-closed seam)", async () => {
    const { hr, form } = await setup();
    const before = await db.employee.count();
    const e = await rejection(
      productionEmployeeService.createEmployee(hr.actor, form as never),
    );
    expect(e.name).toBe("AccountAdminNotConfiguredError");
    expect(await db.employee.count()).toBe(before);
  });
});

describe("employeeService reads", () => {
  it("lists ACTIVE by default with role; TERMINATED/ALL on request; never placeholders", async () => {
    const { service, hr } = await setup();
    const gone = await makeEmployee({
      firstName: "Gone",
      lastName: "Away",
      employmentStatus: "TERMINATED",
      terminatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    await makePlaceholder();

    const active = await service.listEmployees(hr.actor);
    expect(active.map((e) => e.fullName)).toEqual(["Hr Admin", "Emp One"]);
    expect(active.map((e) => e.role)).toEqual(["HR_ADMIN", "EMPLOYEE"]);

    const terminated = await service.listEmployees(hr.actor, {
      status: "TERMINATED",
    });
    expect(terminated).toEqual([
      expect.objectContaining({
        id: gone.id,
        role: null,
        status: "TERMINATED",
        terminatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ]);
    expect(
      await service.listEmployees(hr.actor, { status: "ALL" }),
    ).toHaveLength(3);
  });

  it("pickers show ACTIVE non-placeholder employees by first name", async () => {
    const { service, hr } = await setup();
    await makeEmployee({ firstName: "Aaron", lastName: "Z" });
    await makeEmployee({
      firstName: "Abe",
      employmentStatus: "TERMINATED",
      terminatedAt: new Date(),
    });
    await makePlaceholder();
    const options = await service.listEmployeeOptions(hr.actor);
    expect(options.map((o) => o.label)).toEqual([
      "Aaron Z",
      "Emp One",
      "Hr Admin",
    ]);
  });

  it("an employee sees only their own record; another id is NOT_FOUND (legacy IDOR)", async () => {
    const { service, hr, emp } = await setup();
    expect((await service.getEmployee(emp.actor, emp.employee.id)).id).toBe(
      emp.employee.id,
    );
    expect(
      (await rejection(service.getEmployee(emp.actor, hr.employee.id))).code,
    ).toBe("NOT_FOUND");
    expect((await service.getMyProfile(emp.actor)).firstName).toBe("Emp");
  });

  it("placeholders are NOT_FOUND everywhere, even for HR", async () => {
    const { service, hr, form } = await setup();
    const ph = await makePlaceholder();
    const calls = [
      () => service.getEmployee(hr.actor, ph.id),
      () => service.updateEmployee(hr.actor, ph.id, form as never),
      () => service.terminateEmployee(hr.actor, ph.id),
      () => service.resetEmployeePassword(hr.actor, ph.id),
    ];
    for (const call of calls) {
      expect((await rejection(call())).code).toBe("NOT_FOUND");
    }
  });

  it("an account without an employee record has no profile", async () => {
    const { service, hr } = await setup();
    const e = await rejection(
      service.getMyProfile({ ...hr.actor, employeeId: null }),
    );
    expect(e.code).toBe("NOT_FOUND");
  });

  it("form options list departments and positions by name, plus the enums", async () => {
    const { service, hr } = await setup();
    await makeDepartment("Accounts");
    const options = await service.getEmployeeFormOptions(hr.actor);
    expect(options.departments.map((d) => d.label)).toEqual([
      "Accounts",
      "Engineering",
    ]);
    expect(options.countries).toContain("Bangladesh");
    expect(options.genders).toEqual(["MALE", "FEMALE"]);
  });

  it("HR-only reads are FORBIDDEN for employees", async () => {
    const { service, emp } = await setup();
    for (const call of [
      () => service.listEmployees(emp.actor),
      () => service.listEmployeeOptions(emp.actor),
      () => service.getEmployeeFormOptions(emp.actor),
    ]) {
      expect((await rejection(call())).code).toBe("FORBIDDEN");
    }
  });
});

describe("employeeService.updateEmployee", () => {
  it("updates profile fields without touching the username", async () => {
    const { service, hr, emp, form } = await setup();
    const updated = await service.updateEmployee(hr.actor, emp.employee.id, {
      ...form,
      firstName: "Renamed",
    } as never);
    expect(updated.firstName).toBe("Renamed");
    expect(updated.username).toBe(emp.user.username);
  });

  it("terminated employees can't be edited", async () => {
    const { service, hr, form } = await setup();
    const gone = await makeEmployee({
      employmentStatus: "TERMINATED",
      terminatedAt: new Date(),
    });
    expect(
      (
        await rejection(
          service.updateEmployee(hr.actor, gone.id, form as never),
        )
      ).code,
    ).toBe("CONFLICT");
  });
});

describe("employeeService.terminateEmployee", () => {
  it("terminates: status, login disabled, PENDING leave rejected, history kept", async () => {
    const { service, hr, emp, accounts } = await setup();
    const pending = await leaveService.applyForLeave(emp.actor, {
      leaveType: "SICK",
      startDate: "2026-11-20" as IsoDate,
      endDate: "2026-11-20" as IsoDate,
    });
    const result = await service.terminateEmployee(hr.actor, emp.employee.id);
    expect(result.status).toBe("TERMINATED");
    expect(result.terminatedAt).toMatch(/Z$/);
    expect(accounts.calls).toEqual([`disable:${emp.user.id}`]);

    const leave = await db.leaveRequest.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(leave).toMatchObject({
      status: "REJECTED",
      decidedById: hr.user.id,
    });
    expect(
      (await rejection(service.terminateEmployee(hr.actor, emp.employee.id)))
        .message,
    ).toBe("This employee is already terminated.");
  });

  it("can't terminate yourself", async () => {
    const { service, hr } = await setup();
    expect(
      (await rejection(service.terminateEmployee(hr.actor, hr.employee.id)))
        .message,
    ).toBe("You can't terminate your own account.");
  });

  it("can't terminate the last active HR admin", async () => {
    const { service, hr } = await setup();
    const other = await makePerson("HR_ADMIN");
    // Two admins: one may go.
    await service.terminateEmployee(hr.actor, other.employee.id);
    // An admin without an employee record is the only one left to act.
    const ghost = await makeUser(null, "HR_ADMIN");
    const ghostActor = {
      userId: ghost.id,
      employeeId: null,
      role: "HR_ADMIN" as const,
    };
    expect(
      (await rejection(service.terminateEmployee(ghostActor, hr.employee.id)))
        .message,
    ).toBe("You can't terminate the last active HR admin.");
  });

  it("concurrent terminations of the last two admins: one is refused", async () => {
    const { service, hr } = await setup();
    const other = await makePerson("HR_ADMIN");
    const results = await Promise.allSettled([
      service.terminateEmployee(hr.actor, other.employee.id),
      service.terminateEmployee(other.actor, hr.employee.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.employee.count({
        where: { employmentStatus: "ACTIVE", user: { role: "HR_ADMIN" } },
      }),
    ).toBe(1);
  });
});

describe("employeeService.resetEmployeePassword", () => {
  it("issues a temporary password through AccountAdminApi", async () => {
    const { service, hr, emp, accounts } = await setup();
    const creds = await service.resetEmployeePassword(
      hr.actor,
      emp.employee.id,
    );
    expect(creds).toEqual({
      username: emp.user.username,
      temporaryPassword: "Temp-Password-456",
    });
    expect(accounts.calls).toEqual([`reset:${emp.user.id}`]);
  });

  it("terminated is CONFLICT; no account is NOT_FOUND", async () => {
    const { service, hr } = await setup();
    const gone = await makeEmployee({
      employmentStatus: "TERMINATED",
      terminatedAt: new Date(),
    });
    const noLogin = await makeEmployee();
    expect(
      (await rejection(service.resetEmployeePassword(hr.actor, gone.id))).code,
    ).toBe("CONFLICT");
    expect(
      (await rejection(service.resetEmployeePassword(hr.actor, noLogin.id)))
        .code,
    ).toBe("NOT_FOUND");
  });
});
