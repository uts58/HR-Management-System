/**
 * Employee input schemas (contracts.md#employee, ADR-0005).
 *
 * Rules that need the database or the company time zone are re-checked in
 * the service (ADR-0005 rule 7):
 * - department/position must exist, username must be free;
 * - date of birth must be before today in APP_TIME_ZONE. The schema only
 *   rejects dates that are today or later in every zone (the browser does
 *   not know the company zone); the service compares against
 *   `businessTodayIso()` and throws VALIDATION on `dateOfBirth` with
 *   DATE_OF_BIRTH_NOT_PAST.
 */

import { z } from "zod";
import {
  COUNTRIES,
  EMPLOYMENT_STATUSES,
  GENDERS,
  MARITAL_STATUSES,
  USERNAME_PATTERN,
  type CreateEmployeeInput,
  type EmployeeStatusFilter,
  type UpdateEmployeeInput,
} from "@/contracts/employee";
import { latestTodayIso } from "@/lib/dates";
import {
  entityIdSchema,
  enumField,
  idField,
  idInputSchema,
  isoDateField,
  optionalText,
  requiredText,
} from "./common";

export const NAME_MAX = 100;
export const EMAIL_MAX = 254;
export const CONTACT_NO_MIN = 5;
export const CONTACT_NO_MAX = 20;

export const DATE_OF_BIRTH_NOT_PAST = "Date of birth must be in the past";

const usernameRe = new RegExp(USERNAME_PATTERN);

/**
 * Optional login name: trimmed, lower-cased (usernames are
 * case-insensitive), 3..30 of `[a-z0-9._]`. Blank means "generate the
 * default first.last".
 */
export const usernameField = z
  .preprocess(
    (v) =>
      v == null || (typeof v === "string" && v.trim() === "")
        ? undefined
        : typeof v === "string"
          ? v.trim().toLowerCase()
          : v,
    z
      .string({ error: "Username must be text" })
      .regex(usernameRe, {
        error:
          "Username must be 3-30 characters: lower-case letters, digits, dots or underscores",
      })
      .optional(),
  )
  .optional(); // the key may be omitted

const contactNoField = requiredText("Contact number", CONTACT_NO_MAX)
  .min(CONTACT_NO_MIN, {
    error: `Contact number must be at least ${CONTACT_NO_MIN} characters`,
  })
  .regex(/^[0-9+\-() ]+$/, {
    error:
      "Contact number may only contain digits, spaces and the characters + - ( )",
  })
  .regex(/[0-9]/, { error: "Contact number must contain digits" });

const emailField = z
  .string({ error: "Email is required" })
  .trim()
  .min(1, { error: "Email is required", abort: true })
  .max(EMAIL_MAX, { error: `Email must be at most ${EMAIL_MAX} characters` })
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }));

const dateOfBirthField = isoDateField("Date of birth").refine(
  (v) => v < latestTodayIso(),
  { error: DATE_OF_BIRTH_NOT_PAST },
);

/** Fields shared by create and update. */
const employeeFields = {
  firstName: requiredText("First name", NAME_MAX),
  middleName: optionalText("Middle name", NAME_MAX),
  lastName: requiredText("Last name", NAME_MAX),
  departmentId: idField("Select a department"),
  positionId: idField("Select a position"),
  country: enumField(COUNTRIES, "Select a country"),
  homeTown: requiredText("Home town", NAME_MAX),
  contactNo: contactNoField,
  email: emailField,
  gender: enumField(GENDERS, "Select a gender"),
  maritalStatus: enumField(MARITAL_STATUSES, "Select a marital status"),
  dateOfBirth: dateOfBirthField,
};

export const createEmployeeSchema = z.object({
  ...employeeFields,
  username: usernameField,
}) satisfies z.ZodType<CreateEmployeeInput>;

/** Username is not editable, so it is not part of the update input. */
export const updateEmployeeSchema = z.object(
  employeeFields,
) satisfies z.ZodType<UpdateEmployeeInput>;

/**
 * What the edit-employee action receives: the record id plus the fields.
 * The action passes `id` and the rest separately to
 * `employeeService.updateEmployee(actor, id, input)`.
 */
export const updateEmployeeActionSchema = updateEmployeeSchema.extend({
  id: entityIdSchema,
});

export const terminateEmployeeSchema = idInputSchema;
export const resetEmployeePasswordSchema = idInputSchema;

/**
 * Employee list filter (`?status=`), for `listEmployees`. Anything missing
 * or unknown falls back to ACTIVE, so a bad query string never errors.
 */
export const listEmployeesFilterSchema = z.object({
  status: z
    .enum([
      ...EMPLOYMENT_STATUSES,
      "ALL",
    ] as const satisfies readonly EmployeeStatusFilter[])
    .catch("ACTIVE"),
}) satisfies z.ZodType<{ status?: EmployeeStatusFilter }>;
