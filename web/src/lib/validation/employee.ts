import { z } from "zod";
import {
  COUNTRIES,
  EMPLOYEE_NUMBER_MAX,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  MARITAL_STATUSES,
  USERNAME_PATTERN,
  type CreateEmployeeInput,
  type EmployeeStatusFilter,
  type UpdateEmployeeInput,
} from "@/contracts/employee";
import { isBeforeTodayLenient, isIsoDate } from "@/lib/dates";
import {
  entityIdSchema,
  enumField,
  idField,
  idInputSchema,
  isoDateField,
  optionalEnumField,
  optionalIsoDateField,
  optionalText,
  requiredText,
} from "./common";

export const NAME_MAX = 100;
export const EMAIL_MAX = 254;
export const CONTACT_NO_MIN = 5;
export const CONTACT_NO_MAX = 20;

export const DATE_OF_BIRTH_NOT_PAST = "Date of birth must be in the past";

const usernameRe = new RegExp(USERNAME_PATTERN);

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
  .optional();

const filled = (test: (v: string) => boolean) => (v: string) =>
  v === "" || test(v);

const contactNoField = requiredText("Contact number", CONTACT_NO_MAX)
  .refine(
    filled((v) => v.length >= CONTACT_NO_MIN),
    `Contact number must be at least ${CONTACT_NO_MIN} characters`,
  )
  .refine(
    filled((v) => /^[0-9+\-() ]+$/.test(v)),
    "Contact number may only contain digits, spaces and the characters + - ( )",
  )
  .refine(
    filled((v) => /[0-9]/.test(v)),
    "Contact number must contain digits",
  );

const emailField = z
  .string({ error: "Email is required" })
  .trim()
  .min(1, { error: "Email is required" })
  .max(EMAIL_MAX, { error: `Email must be at most ${EMAIL_MAX} characters` })
  .toLowerCase()
  // A pipe stops at the first stage's issues, so "" is only "required".
  .pipe(z.email({ error: "Enter a valid email address" }));

const dateOfBirthField = isoDateField("Date of birth").refine(
  (v) => !isIsoDate(v) || isBeforeTodayLenient(v),
  { error: DATE_OF_BIRTH_NOT_PAST },
);

const employeeFields = {
  firstName: requiredText("First name", NAME_MAX),
  middleName: optionalText("Middle name", NAME_MAX),
  lastName: requiredText("Last name", NAME_MAX),
  departmentId: idField("Select a department"),
  positionId: idField("Select a position"),
  employmentType: enumField(EMPLOYMENT_TYPES, "Select an employment type"),
  hireDate: optionalIsoDateField("Hire date"),
  employeeNumber: optionalText("Employee number", EMPLOYEE_NUMBER_MAX),
  country: enumField(COUNTRIES, "Select a country"),
  homeTown: requiredText("Home town", NAME_MAX),
  contactNo: contactNoField,
  email: emailField,
  gender: optionalEnumField(GENDERS, "Select a gender"),
  maritalStatus: enumField(MARITAL_STATUSES, "Select a marital status"),
  dateOfBirth: dateOfBirthField,
};

export const createEmployeeSchema = z.object({
  ...employeeFields,
  username: usernameField,
}) satisfies z.ZodType<CreateEmployeeInput>;

export const updateEmployeeSchema = z.object(
  employeeFields,
) satisfies z.ZodType<UpdateEmployeeInput>;

export const updateEmployeeActionSchema = updateEmployeeSchema.extend({
  id: entityIdSchema,
});

export const terminateEmployeeSchema = idInputSchema;
export const resetEmployeePasswordSchema = idInputSchema;

export const listEmployeesFilterSchema = z.object({
  status: z
    .enum([
      ...EMPLOYMENT_STATUSES,
      "ALL",
    ] as const satisfies readonly EmployeeStatusFilter[])
    .catch("ACTIVE"),
}) satisfies z.ZodType<{ status?: EmployeeStatusFilter }>;
