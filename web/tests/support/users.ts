/**
 * Accounts available to E2E tests. The first block comes from Data's
 * prisma/seed.ts; the QA block is added by tests/support/db/qa-fixtures.sql.
 * Keep both files in sync with this list.
 *
 * Rule: a test that changes a user (password, termination, reset) uses a
 * user dedicated to that test, so specs stay independent and parallel-safe.
 */
export type RoleName = "HR_ADMIN" | "EMPLOYEE";

export interface TestUser {
  username: string;
  password: string;
  role: RoleName;
  employeeId: number;
  firstName: string;
  lastName: string;
  mustChangePassword?: boolean;
}

const SEED_EMP_PASSWORD = "Employee#123";
/** Password of every QA fixture user (bcrypt in the fixture SQL). */
export const QA_PASSWORD = "QaPass#2026";

const user = (u: TestUser) => u;

export const users = {
  // ---- Data's seed (prisma/seed.ts) ----
  admin: user({
    username: "admin",
    password: "Admin#12345",
    role: "HR_ADMIN",
    employeeId: 1,
    firstName: "Admin",
    lastName: "User",
  }),
  john: user({
    username: "john.doe",
    password: SEED_EMP_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 2,
    firstName: "John",
    lastName: "Doe",
  }),
  /** mustChangePassword = true in the seed. Read-only use (forced-change redirect checks). */
  jane: user({
    username: "jane.smith",
    password: SEED_EMP_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 3,
    firstName: "Jane",
    lastName: "Smith",
    mustChangePassword: true,
  }),
  raj: user({
    username: "raj.patel",
    password: SEED_EMP_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 4,
    firstName: "Raj",
    lastName: "Patel",
  }),
  /** TERMINATED in the seed (users.disabledAt set). Must not be able to sign in. */
  mary: user({
    username: "mary.jones",
    password: SEED_EMP_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 5,
    firstName: "Mary",
    lastName: "Jones",
  }),

  // ---- QA fixtures (tests/support/db/qa-fixtures.sql) ----
  /** Login email is a placeholder and there is no contact email: "No email on file". */
  nora: user({
    username: "nora.noemail",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 102,
    firstName: "Nora",
    lastName: "Noemail",
  }),
  /** Login email is a placeholder but a contact email exists: the contact email is shown. */
  carl: user({
    username: "carl.contact",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 103,
    firstName: "Carl",
    lastName: "Contact",
  }),
  /** Terminated by the terminate journey. */
  terry: user({
    username: "terry.terminate",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 104,
    firstName: "Terry",
    lastName: "Terminate",
  }),
  /** Password reset by HR in the reset journey. */
  rita: user({
    username: "rita.reset",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 105,
    firstName: "Rita",
    lastName: "Reset",
  }),
  /** Changes their own password in the change-password journey. */
  chad: user({
    username: "chad.changer",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 106,
    firstName: "Chad",
    lastName: "Changer",
  }),
  /** mustChangePassword = true; completes the forced change. */
  fran: user({
    username: "fran.forced",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 107,
    firstName: "Fran",
    lastName: "Forced",
    mustChangePassword: true,
  }),
  /** Applies for leave in the leave journeys (keeps John's seeded rows untouched). */
  lena: user({
    username: "lena.leave",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 108,
    firstName: "Lena",
    lastName: "Leave",
  }),
  /** Renamed by the edit journey; logs in afterwards with the same username. */
  eric: user({
    username: "eric.edit",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 109,
    firstName: "Eric",
    lastName: "Edit",
  }),
} as const;

/** Placeholder employee (legacy orphan): TERMINATED, no login, isPlaceholder. */
export const placeholderEmployee = { id: 101, name: "Unknown employee #101" };

/** Seeded leave request whose calendar dates must render unchanged in every zone. */
export const seededJohnLeave = {
  start: "2026-12-22",
  end: "2026-12-31",
  label: "22 Dec 2026 – 31 Dec 2026",
};

export const fullName = (u: Pick<TestUser, "firstName" | "lastName">) =>
  `${u.firstName} ${u.lastName}`;

/** Unique, readable suffix so data created by one test never collides with another. */
export function uid(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}
