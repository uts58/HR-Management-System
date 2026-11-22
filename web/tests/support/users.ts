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
export const QA_PASSWORD = "QaPass#2026";

const user = (u: TestUser) => u;

export const users = {
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
  mary: user({
    username: "mary.jones",
    password: SEED_EMP_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 5,
    firstName: "Mary",
    lastName: "Jones",
  }),

  nora: user({
    username: "nora.noemail",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 102,
    firstName: "Nora",
    lastName: "Noemail",
  }),
  carl: user({
    username: "carl.contact",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 103,
    firstName: "Carl",
    lastName: "Contact",
  }),
  terry: user({
    username: "terry.terminate",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 104,
    firstName: "Terry",
    lastName: "Terminate",
  }),
  rita: user({
    username: "rita.reset",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 105,
    firstName: "Rita",
    lastName: "Reset",
  }),
  chad: user({
    username: "chad.changer",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 106,
    firstName: "Chad",
    lastName: "Changer",
  }),
  fran: user({
    username: "fran.forced",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 107,
    firstName: "Fran",
    lastName: "Forced",
    mustChangePassword: true,
  }),
  lena: user({
    username: "lena.leave",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 108,
    firstName: "Lena",
    lastName: "Leave",
  }),
  eric: user({
    username: "eric.edit",
    password: QA_PASSWORD,
    role: "EMPLOYEE",
    employeeId: 109,
    firstName: "Eric",
    lastName: "Edit",
  }),
} as const;

export const seededJohnLeave = {
  start: "2026-12-22",
  end: "2026-12-31",
  label: "22 Dec 2026 – 31 Dec 2026",
};

export const fullName = (u: Pick<TestUser, "firstName" | "lastName">) =>
  `${u.firstName} ${u.lastName}`;

export function uid(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}
