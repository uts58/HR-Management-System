/**
 * STUB DATA (Phase 1a). Typed fixtures that conform to web/src/contracts so
 * the screens can be built before Backend's services exist. Delete this
 * folder once every seam in ./services.ts has been swapped for the real
 * service call.
 *
 * The rows deliberately include the awkward cases the real data will have:
 * a terminated employee, a placeholder employee ("Unknown employee #N"),
 * migrated rows with null dates, an OTHER leave type with legacy text, an
 * employee with no email on file, and an urgent notice.
 */

import type {
  Appraisal,
  Department,
  EmployeeDetail,
  EmployeeRef,
  LeaveRequest,
  Notice,
  Position,
} from "@/contracts";

import { at, iso } from "./dates";

export const departments: Department[] = [
  { id: 1, name: "Human Resources", employeeCount: 1, totalEmployeeCount: 1 },
  { id: 2, name: "Engineering", employeeCount: 2, totalEmployeeCount: 3 },
  { id: 3, name: "Finance", employeeCount: 1, totalEmployeeCount: 1 },
  { id: 4, name: "Facilities", employeeCount: 0, totalEmployeeCount: 0 },
];

export const positions: Position[] = [
  { id: 1, name: "HR Manager", employeeCount: 1, totalEmployeeCount: 1 },
  { id: 2, name: "Software Engineer", employeeCount: 2, totalEmployeeCount: 3 },
  { id: 3, name: "Accountant", employeeCount: 1, totalEmployeeCount: 1 },
  { id: 4, name: "Intern", employeeCount: 0, totalEmployeeCount: 0 },
];

const option = <T extends { id: number; name: string }>(row: T) => ({
  id: row.id,
  label: row.name,
});

export const employees: EmployeeDetail[] = [
  {
    id: 1,
    firstName: "Amina",
    middleName: null,
    lastName: "Rahman",
    department: option(departments[0]!),
    position: option(positions[0]!),
    country: "Bangladesh",
    homeTown: "Dhaka",
    contactNo: "+880 1711-000001",
    email: "amina.rahman@example.com",
    emailIsPlaceholder: false,
    gender: "FEMALE",
    maritalStatus: "MARRIED",
    dateOfBirth: iso("1984-03-12"),
    username: "admin",
    status: "ACTIVE",
    terminatedAt: null,
    createdAt: null,
  },
  {
    id: 2,
    firstName: "Rafiq",
    middleName: "Hasan",
    lastName: "Chowdhury",
    department: option(departments[1]!),
    position: option(positions[1]!),
    country: "Bangladesh",
    homeTown: "Chattogram",
    contactNo: "01811-000002",
    email: "rafiq.chowdhury@example.com",
    emailIsPlaceholder: false,
    gender: "MALE",
    maritalStatus: "SINGLE",
    dateOfBirth: iso("1993-11-02"),
    username: "rafiq",
    status: "ACTIVE",
    terminatedAt: null,
    createdAt: at("2026-02-03T04:15:00Z"),
  },
  {
    id: 3,
    firstName: "Priya",
    middleName: null,
    lastName: "Sharma",
    department: option(departments[1]!),
    position: option(positions[1]!),
    country: "India",
    homeTown: "Pune",
    contactNo: "+91 98200 00003",
    // Migrated user whose legacy email was missing: the login account got
    // the placeholder address, so the profile shows "No email on file".
    email: null,
    emailIsPlaceholder: true,
    gender: "FEMALE",
    maritalStatus: null,
    dateOfBirth: null,
    username: "priya",
    status: "ACTIVE",
    terminatedAt: null,
    createdAt: null,
  },
  {
    id: 4,
    firstName: "Daniel",
    middleName: null,
    lastName: "Weber",
    department: option(departments[2]!),
    position: option(positions[2]!),
    country: "Germany",
    homeTown: "Hamburg",
    contactNo: "+49 40 000004",
    email: "daniel.weber@example.com",
    emailIsPlaceholder: false,
    gender: "MALE",
    maritalStatus: "DIVORCED",
    dateOfBirth: iso("1988-07-21"),
    username: "daniel.weber",
    status: "ACTIVE",
    terminatedAt: null,
    createdAt: at("2026-05-19T09:30:00Z"),
  },
  {
    id: 5,
    firstName: "Sofia",
    middleName: null,
    lastName: "Martinez",
    department: option(departments[1]!),
    position: option(positions[1]!),
    country: "USA",
    homeTown: "Austin",
    contactNo: "+1 512 000 0005",
    email: "sofia.martinez@example.com",
    emailIsPlaceholder: false,
    gender: "FEMALE",
    maritalStatus: "SINGLE",
    dateOfBirth: iso("1995-01-30"),
    username: "sofia.martinez",
    status: "TERMINATED",
    terminatedAt: at("2026-09-30T11:00:00Z"),
    createdAt: at("2026-01-10T03:00:00Z"),
  },
];

/** Role per employee id (null = no login account). Mirrors EmployeeListItem.role. */
export const employeeRoles: Record<number, "HR_ADMIN" | "EMPLOYEE" | null> = {
  1: "HR_ADMIN",
  2: "EMPLOYEE",
  3: "EMPLOYEE",
  4: "EMPLOYEE",
  5: "EMPLOYEE",
};

const ref = (id: number): EmployeeRef => {
  const e = employees.find((row) => row.id === id);
  if (!e) {
    return {
      id,
      name: `Unknown employee #${id}`,
      status: "TERMINATED",
      isPlaceholder: true,
    };
  }
  return {
    id,
    name: `${e.firstName} ${e.lastName}`,
    status: e.status,
    isPlaceholder: false,
  };
};

export const leaveRequests: LeaveRequest[] = [
  {
    id: 7,
    employee: ref(2),
    leaveType: "ANNUAL",
    legacyLeaveType: null,
    startDate: iso("2026-12-22"),
    endDate: iso("2026-12-31"),
    reason: "Family visit over the holidays.",
    status: "PENDING",
    seenByEmployee: true,
    createdAt: at("2026-11-15T05:42:00Z"),
    decidedAt: null,
  },
  {
    id: 6,
    employee: ref(4),
    leaveType: "SICK",
    legacyLeaveType: null,
    startDate: iso("2026-11-10"),
    endDate: iso("2026-11-11"),
    reason: null,
    status: "PENDING",
    seenByEmployee: true,
    createdAt: at("2026-11-12T08:05:00Z"),
    decidedAt: null,
  },
  {
    id: 5,
    employee: ref(2),
    leaveType: "CASUAL",
    legacyLeaveType: null,
    startDate: iso("2026-10-06"),
    endDate: iso("2026-10-06"),
    reason: "Moving house.",
    status: "APPROVED",
    seenByEmployee: false,
    createdAt: at("2026-09-28T10:00:00Z"),
    decidedAt: at("2026-09-29T03:20:00Z"),
  },
  {
    id: 4,
    employee: ref(5),
    leaveType: "UNPAID",
    legacyLeaveType: null,
    startDate: iso("2026-10-01"),
    endDate: iso("2026-10-15"),
    reason: "Rejected automatically on termination.",
    status: "REJECTED",
    seenByEmployee: true,
    createdAt: at("2026-09-20T07:00:00Z"),
    decidedAt: at("2026-09-30T11:00:00Z"),
  },
  {
    id: 3,
    employee: ref(2),
    leaveType: "SICK",
    legacyLeaveType: null,
    startDate: iso("2026-06-02"),
    endDate: iso("2026-06-03"),
    reason: "Flu.",
    status: "REJECTED",
    seenByEmployee: true,
    createdAt: at("2026-06-01T02:00:00Z"),
    decidedAt: at("2026-06-01T06:00:00Z"),
  },
  {
    // Migrated legacy row: unrecognised type text, unparseable dates and an
    // employee that legacy hard-deleted (placeholder).
    id: 1,
    employee: ref(42),
    leaveType: "OTHER",
    legacyLeaveType: "Study leave",
    startDate: null,
    endDate: null,
    reason: "next week sometime",
    status: "APPROVED",
    seenByEmployee: true,
    createdAt: null,
    decidedAt: null,
  },
];

export const notices: Notice[] = [
  {
    id: 4,
    title: "Office closed for maintenance on Friday",
    body: "The building will be closed on Friday for electrical maintenance. Please work from home and keep your phone reachable.",
    type: "URGENT",
    createdAt: at("2026-11-16T03:30:00Z"),
  },
  {
    id: 3,
    title: "Victory Day holiday",
    body: "The office is closed on 16 December for Victory Day.",
    type: "HOLIDAY",
    createdAt: at("2026-11-10T04:00:00Z"),
  },
  {
    id: 2,
    title: "New leave process",
    body: "Leave requests are now submitted and reviewed in the new HR system. Your history has been carried over.",
    type: "GENERAL",
    createdAt: at("2026-11-01T06:00:00Z"),
  },
  {
    id: 1,
    title: "Welcome to the HR portal",
    body: "Legacy notice migrated without a parseable date.",
    type: "GENERAL",
    createdAt: null,
  },
];

export const appraisals: Appraisal[] = [
  {
    id: 3,
    employee: ref(4),
    projectName: "Quarter-end close automation",
    projectStart: iso("2026-07-01"),
    projectEnd: iso("2026-09-30"),
    rating: 4,
    createdAt: at("2026-10-05T05:00:00Z"),
  },
  {
    id: 2,
    employee: ref(5),
    projectName: "Mobile onboarding",
    projectStart: iso("2026-02-01"),
    projectEnd: iso("2026-06-30"),
    rating: 3,
    createdAt: at("2026-07-10T05:00:00Z"),
  },
  {
    id: 1,
    employee: ref(17),
    projectName: null,
    projectStart: null,
    projectEnd: null,
    rating: null,
    createdAt: null,
  },
];
