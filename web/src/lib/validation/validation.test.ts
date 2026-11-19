import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  applyForLeaveSchema,
  changePasswordSchema,
  createAppraisalSchema,
  createDepartmentSchema,
  createEmployeeSchema,
  createNoticeSchema,
  createPositionSchema,
  decideLeaveRequestSchema,
  deleteDepartmentSchema,
  entityIdSchema,
  listEmployeesFilterSchema,
  noInputSchema,
  signInSchema,
  updateEmployeeActionSchema,
  updateEmployeeSchema,
} from "./index";

/** Field errors of a failed parse (fails the test if parsing succeeded). */
function errorsOf(schema: z.ZodType, input: unknown) {
  const r = schema.safeParse(input);
  expect(r.success, "expected the parse to fail").toBe(false);
  return r.success
    ? {}
    : (z.flattenError(r.error).fieldErrors as Record<string, string[]>);
}

// Freeze "now" so date-of-birth checks are deterministic.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-17T12:00:00Z"), toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

// FormData-like input: everything is a string.
const validEmployeeForm = {
  firstName: "  Ada ",
  middleName: "",
  lastName: "Lovelace",
  departmentId: "2",
  positionId: "3",
  country: "Germany",
  homeTown: "London",
  contactNo: "+44 (20) 7946-0000",
  email: "  Ada.Lovelace@Example.COM ",
  gender: "FEMALE",
  maritalStatus: "MARRIED",
  dateOfBirth: "1990-12-10",
  username: "",
};

describe("createEmployeeSchema", () => {
  it("parses a valid form, trimming and coercing", () => {
    expect(createEmployeeSchema.parse(validEmployeeForm)).toEqual({
      firstName: "Ada",
      middleName: null,
      lastName: "Lovelace",
      departmentId: 2,
      positionId: 3,
      country: "Germany",
      homeTown: "London",
      contactNo: "+44 (20) 7946-0000",
      email: "ada.lovelace@example.com",
      gender: "FEMALE",
      maritalStatus: "MARRIED",
      dateOfBirth: "1990-12-10",
      username: undefined,
    });
  });

  it("keeps a provided middle name and lower-cases the username", () => {
    const r = createEmployeeSchema.parse({
      ...validEmployeeForm,
      middleName: " King ",
      username: " Ada.L ",
    });
    expect(r.middleName).toBe("King");
    expect(r.username).toBe("ada.l");
  });

  it("requires every field except middle name and username", () => {
    const errors = errorsOf(createEmployeeSchema, {});
    expect(Object.keys(errors).sort()).toEqual(
      [
        "contactNo",
        "country",
        "dateOfBirth",
        "departmentId",
        "email",
        "firstName",
        "gender",
        "homeTown",
        "lastName",
        "maritalStatus",
        "positionId",
      ].sort(),
    );
    expect(errors.firstName).toEqual(["First name is required"]);
    expect(errors.departmentId).toEqual(["Select a department"]);
    expect(errors.country).toEqual(["Select a country"]);
  });

  it("treats whitespace-only names as missing", () => {
    expect(
      errorsOf(createEmployeeSchema, { ...validEmployeeForm, lastName: "   " })
        .lastName,
    ).toEqual(["Last name is required"]);
  });

  it("enforces max lengths", () => {
    const long = "x".repeat(101);
    const errors = errorsOf(createEmployeeSchema, {
      ...validEmployeeForm,
      firstName: long,
      middleName: long,
      homeTown: long,
      email: `${"a".repeat(250)}@x.io`,
    });
    expect(errors.firstName).toEqual([
      "First name must be at most 100 characters",
    ]);
    expect(errors.middleName).toBeDefined();
    expect(errors.homeTown).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it.each(["0", "-1", "abc", "1.5", "99999999999"])(
    "rejects department id %j (legacy '0' sentinel)",
    (departmentId) => {
      expect(
        errorsOf(createEmployeeSchema, { ...validEmployeeForm, departmentId })
          .departmentId,
      ).toEqual(["Select a department"]);
    },
  );

  it("rejects a country outside the list", () => {
    expect(
      errorsOf(createEmployeeSchema, {
        ...validEmployeeForm,
        country: "France",
      }).country,
    ).toEqual(["Select a country"]);
  });

  it.each([
    ["1234", "at least 5"],
    ["123456789012345678901", "at most 20"],
    ["12345abc", "may only contain"],
    ["(+) -", "must contain digits"],
  ])("rejects contact number %j", (contactNo, fragment) => {
    const errors = errorsOf(createEmployeeSchema, {
      ...validEmployeeForm,
      contactNo,
    });
    expect(errors.contactNo?.join(" ")).toContain(fragment);
  });

  it.each(["not-an-email", "a@b", "a b@c.com"])("rejects email %j", (email) => {
    expect(
      errorsOf(createEmployeeSchema, { ...validEmployeeForm, email }).email,
    ).toEqual(["Enter a valid email address"]);
  });

  it("rejects legacy gender / marital values", () => {
    const errors = errorsOf(createEmployeeSchema, {
      ...validEmployeeForm,
      gender: "1",
      maritalStatus: "0",
    });
    expect(errors.gender).toEqual(["Select a gender"]);
    expect(errors.maritalStatus).toEqual(["Select a marital status"]);
  });

  it.each(["01 Jan 1990", "1990-02-30", "1899-12-31"])(
    "rejects date of birth %j",
    (dateOfBirth) => {
      expect(
        errorsOf(createEmployeeSchema, { ...validEmployeeForm, dateOfBirth })
          .dateOfBirth,
      ).toHaveLength(1);
    },
  );

  it("date of birth must be before today (UTC date, one-day tolerance)", () => {
    // now = 2026-11-17 12:00Z. Tomorrow (UTC) and later are rejected.
    for (const dateOfBirth of ["2026-11-18", "2030-01-01"]) {
      expect(
        errorsOf(createEmployeeSchema, { ...validEmployeeForm, dateOfBirth })
          .dateOfBirth,
      ).toEqual(["Date of birth must be in the past"]);
    }
    // Today's UTC date is tolerated: for users ahead of UTC it is already
    // yesterday.
    expect(
      createEmployeeSchema.safeParse({
        ...validEmployeeForm,
        dateOfBirth: "2026-11-17",
      }).success,
    ).toBe(true);
  });

  it.each(["ab", "a".repeat(31), "ada lovelace", "ada-l", "adä"])(
    "rejects username %j",
    (username) => {
      expect(
        errorsOf(createEmployeeSchema, { ...validEmployeeForm, username })
          .username,
      ).toHaveLength(1);
    },
  );

  it.each(["abc", "a.b_c", "user123", "a".repeat(30)])(
    "accepts username %j",
    (username) => {
      expect(
        createEmployeeSchema.parse({ ...validEmployeeForm, username }).username,
      ).toBe(username);
    },
  );
});

describe("updateEmployeeSchema", () => {
  it("has no username and strips one if sent", () => {
    const r = updateEmployeeSchema.parse({
      ...validEmployeeForm,
      username: "hacker",
    });
    expect(r).not.toHaveProperty("username");
  });

  it("action schema adds a required id", () => {
    expect(
      updateEmployeeActionSchema.parse({ ...validEmployeeForm, id: "7" }),
    ).toMatchObject({ id: 7, firstName: "Ada" });
    expect(errorsOf(updateEmployeeActionSchema, validEmployeeForm).id).toEqual([
      "Invalid id",
    ]);
  });
});

describe("listEmployeesFilterSchema", () => {
  it.each([
    [{}, "ACTIVE"],
    [{ status: "TERMINATED" }, "TERMINATED"],
    [{ status: "ALL" }, "ALL"],
    [{ status: "bogus" }, "ACTIVE"],
  ])("%j -> %s", (input, status) => {
    expect(listEmployeesFilterSchema.parse(input)).toEqual({ status });
  });
});

describe("org schemas", () => {
  it.each([createDepartmentSchema, createPositionSchema])(
    "trims and requires the name",
    (schema) => {
      expect(schema.parse({ name: "  Finance " })).toEqual({ name: "Finance" });
      expect(errorsOf(schema, { name: "   " }).name).toEqual([
        "Name is required",
      ]);
      expect(errorsOf(schema, {}).name).toEqual(["Name is required"]);
      expect(errorsOf(schema, { name: "x".repeat(101) }).name).toEqual([
        "Name must be at most 100 characters",
      ]);
    },
  );

  it("delete takes an id", () => {
    expect(deleteDepartmentSchema.parse({ id: "4" })).toEqual({ id: 4 });
    expect(errorsOf(deleteDepartmentSchema, { id: "" }).id).toBeDefined();
  });
});

describe("applyForLeaveSchema (BUG-12)", () => {
  const valid = {
    leaveType: "SICK",
    startDate: "2026-11-20",
    endDate: "2026-11-21",
    reason: "  flu ",
  };

  it("parses a valid request", () => {
    expect(applyForLeaveSchema.parse(valid)).toEqual({
      leaveType: "SICK",
      startDate: "2026-11-20",
      endDate: "2026-11-21",
      reason: "flu",
    });
  });

  it("allows a single-day and a past request; blank reason -> null", () => {
    expect(
      applyForLeaveSchema.parse({
        ...valid,
        startDate: "2020-01-01",
        endDate: "2020-01-01",
        reason: "",
      }),
    ).toMatchObject({ startDate: "2020-01-01", reason: null });
  });

  it("requires both dates", () => {
    const errors = errorsOf(applyForLeaveSchema, {
      ...valid,
      startDate: "",
      endDate: undefined,
    });
    expect(errors.startDate).toEqual(["Start date is required"]);
    expect(errors.endDate).toEqual(["End date is required"]);
  });

  it.each(["tomorrow", "2026-02-30", "20/11/2026"])(
    "rejects free-text date %j",
    (startDate) => {
      expect(
        errorsOf(applyForLeaveSchema, { ...valid, startDate }).startDate,
      ).toEqual(["Start date must be a valid date (YYYY-MM-DD)"]);
    },
  );

  it("rejects end before start, on field endDate", () => {
    expect(
      errorsOf(applyForLeaveSchema, {
        ...valid,
        startDate: "2026-11-21",
        endDate: "2026-11-20",
      }).endDate,
    ).toEqual(["End date cannot be before the start date"]);
  });

  it("rejects OTHER and unknown leave types for new requests", () => {
    for (const leaveType of ["OTHER", "Sick Leave", ""]) {
      expect(
        errorsOf(applyForLeaveSchema, { ...valid, leaveType }).leaveType,
      ).toEqual(["Select a leave type"]);
    }
  });

  it("limits the reason to 1000 characters", () => {
    expect(
      errorsOf(applyForLeaveSchema, { ...valid, reason: "x".repeat(1001) })
        .reason,
    ).toEqual(["Reason must be at most 1000 characters"]);
  });
});

describe("decideLeaveRequestSchema", () => {
  it("accepts APPROVED / REJECTED only", () => {
    expect(
      decideLeaveRequestSchema.parse({ id: "3", decision: "APPROVED" }),
    ).toEqual({ id: 3, decision: "APPROVED" });
    for (const decision of ["PENDING", "1", ""]) {
      expect(
        errorsOf(decideLeaveRequestSchema, { id: 3, decision }).decision,
      ).toEqual(["Choose approve or reject"]);
    }
  });
});

describe("createNoticeSchema", () => {
  it("parses and trims", () => {
    expect(
      createNoticeSchema.parse({
        title: " Hi ",
        body: " Body ",
        type: "URGENT",
      }),
    ).toEqual({ title: "Hi", body: "Body", type: "URGENT" });
  });

  it("requires title, body and type (legacy stored empty strings)", () => {
    const errors = errorsOf(createNoticeSchema, {
      title: " ",
      body: "",
      type: "1",
    });
    expect(errors.title).toEqual(["Title is required"]);
    expect(errors.body).toEqual(["Notice text is required"]);
    expect(errors.type).toEqual(["Select a notice type"]);
  });

  it("enforces max lengths", () => {
    const errors = errorsOf(createNoticeSchema, {
      title: "x".repeat(201),
      body: "x".repeat(5001),
      type: "GENERAL",
    });
    expect(errors.title).toBeDefined();
    expect(errors.body).toBeDefined();
  });
});

describe("createAppraisalSchema (BUG-11)", () => {
  const valid = {
    employeeId: "5",
    projectName: " Apollo ",
    projectStart: "2026-01-01",
    projectEnd: "2026-06-30",
    rating: "3",
  };

  it("parses a valid appraisal", () => {
    expect(createAppraisalSchema.parse(valid)).toEqual({
      employeeId: 5,
      projectName: "Apollo",
      projectStart: "2026-01-01",
      projectEnd: "2026-06-30",
      rating: 3,
    });
  });

  it("reports a missing employee on employeeId instead of failing silently", () => {
    expect(
      errorsOf(createAppraisalSchema, { ...valid, employeeId: "" }).employeeId,
    ).toEqual(["Select an employee"]);
  });

  it.each(["0", "6", "2.5", "x", "", -1])("rejects rating %j", (rating) => {
    expect(
      errorsOf(createAppraisalSchema, { ...valid, rating }).rating,
    ).toEqual(["Rating must be between 1 and 5"]);
  });

  it.each([1, 5, "1", "5"])("accepts rating %j", (rating) => {
    expect(createAppraisalSchema.parse({ ...valid, rating }).rating).toBe(
      Number(rating),
    );
  });

  it("rejects end before start, on projectEnd", () => {
    expect(
      errorsOf(createAppraisalSchema, {
        ...valid,
        projectStart: "2026-02-01",
        projectEnd: "2026-01-31",
      }).projectEnd,
    ).toEqual(["End date cannot be before the start date"]);
  });

  it("requires project name and dates", () => {
    const errors = errorsOf(createAppraisalSchema, {
      ...valid,
      projectName: "",
      projectStart: "",
      projectEnd: "bad",
    });
    expect(errors.projectName).toEqual(["Project name is required"]);
    expect(errors.projectStart).toEqual(["Start date is required"]);
    expect(errors.projectEnd).toEqual([
      "End date must be a valid date (YYYY-MM-DD)",
    ]);
  });
});

describe("auth form schemas", () => {
  it("signIn lower-cases the username and keeps the password as typed", () => {
    expect(
      signInSchema.parse({ username: "  ADMIN ", password: " Secret " }),
    ).toEqual({ username: "admin", password: " Secret " });
    const errors = errorsOf(signInSchema, { username: "", password: "" });
    expect(errors.username).toEqual(["Please enter the username"]);
    expect(errors.password).toEqual(["Please enter the password"]);
  });

  const validChange = {
    currentPassword: "old-password",
    newPassword: "new-password",
    confirmPassword: "new-password",
  };

  it("changePassword accepts a valid change", () => {
    expect(changePasswordSchema.parse(validChange)).toEqual(validChange);
  });

  it("rejects an empty new password (BUG-05)", () => {
    expect(
      errorsOf(changePasswordSchema, {
        ...validChange,
        newPassword: "",
        confirmPassword: "",
      }).newPassword,
    ).toEqual(["New password is required"]);
  });

  it("enforces 8..128 characters", () => {
    expect(
      errorsOf(changePasswordSchema, {
        ...validChange,
        newPassword: "short",
        confirmPassword: "short",
      }).newPassword,
    ).toEqual(["New password must be at least 8 characters"]);
    const long = "x".repeat(129);
    expect(
      errorsOf(changePasswordSchema, {
        ...validChange,
        newPassword: long,
        confirmPassword: long,
      }).newPassword,
    ).toEqual(["New password must be at most 128 characters"]);
  });

  it("reports a mismatch on confirmPassword", () => {
    expect(
      errorsOf(changePasswordSchema, {
        ...validChange,
        confirmPassword: "different-1",
      }).confirmPassword,
    ).toEqual(["Passwords do not match"]);
  });

  it("rejects reusing the current password", () => {
    expect(
      errorsOf(changePasswordSchema, {
        currentPassword: "same-password",
        newPassword: "same-password",
        confirmPassword: "same-password",
      }).newPassword,
    ).toEqual(["New password must be different from the current password"]);
  });

  it("does not trim passwords", () => {
    expect(
      changePasswordSchema.parse({
        ...validChange,
        newPassword: " spaced  pw ",
        confirmPassword: " spaced  pw ",
      }).newPassword,
    ).toBe(" spaced  pw ");
  });
});

describe("common helpers", () => {
  it("entityIdSchema accepts digits and positive ints only", () => {
    expect(entityIdSchema.parse("12")).toBe(12);
    expect(entityIdSchema.parse(12)).toBe(12);
    for (const bad of ["", "0", "-3", "1e3", "12abc", 1.5, null, 2 ** 31]) {
      expect(entityIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("noInputSchema ignores input", () => {
    expect(noInputSchema.parse(undefined)).toBeUndefined();
    expect(noInputSchema.parse({ anything: 1 })).toBeUndefined();
  });
});
