/**
 * Employee domain contract. Implemented by Backend in web/src/server/employee/.
 * Business rules: docs/architecture/contracts.md#employee
 */

import type {
  Actor,
  DepartmentId,
  EmployeeId,
  IsoDate,
  Option,
  PositionId,
  Timestamp,
} from './common';
import type { Role } from './auth';

// ─── Enumerations (legacy values in comments) ─────────────────────────────────

/** Legacy `employee.gender`: 1 = male, 0 = female. */
export const GENDERS = ['MALE', 'FEMALE'] as const;
export type Gender = (typeof GENDERS)[number];

/** Legacy `employee.maritalStatus`: 'single' | 'married' | 'divorced' ('0' = not chosen, treated as null). */
export const MARITAL_STATUSES = ['SINGLE', 'MARRIED', 'DIVORCED'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

/** Legacy country dropdown, values stored verbatim. */
export const COUNTRIES = [
  'Bangladesh',
  'Nepal',
  'India',
  'Pakistan',
  'USA',
  'Germany',
  'Canada',
  'Australia',
] as const;
export type Country = (typeof COUNTRIES)[number];

// ─── Read models ──────────────────────────────────────────────────────────────

/** Row on the HR "Manage Employees" table. */
export interface EmployeeListItem {
  id: EmployeeId;
  fullName: string; // "First Middle Last", middle omitted when empty
  positionName: string | null;
  departmentName: string | null;
  email: string | null;
  role: Role | null; // null when the employee has no login account
}

/**
 * Full record. Optional fields are nullable because migrated legacy rows
 * may have them empty, even though create/update now require most of them.
 */
export interface EmployeeDetail {
  id: EmployeeId;
  firstName: string;
  middleName: string | null;
  lastName: string;
  department: Option<DepartmentId> | null;
  position: Option<PositionId> | null;
  country: string | null; // string, not Country: legacy data may hold other values
  homeTown: string | null;
  contactNo: string | null;
  email: string | null;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  dateOfBirth: IsoDate | null;
  username: string | null; // login name, null when no account
  createdAt: Timestamp | null; // null for migrated rows
}

export interface EmployeeFormOptions {
  departments: Option<DepartmentId>[];
  positions: Option<PositionId>[];
  countries: readonly Country[];
  genders: readonly Gender[];
  maritalStatuses: readonly MaritalStatus[];
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

/**
 * Create input. The employee id is NOT an input: the database assigns it
 * (legacy computed max(id)+1 in the browser).
 */
export interface CreateEmployeeInput {
  firstName: string; // 1..100, trimmed
  middleName?: string | null; // 0..100
  lastName: string; // 1..100
  departmentId: DepartmentId; // must exist
  positionId: PositionId; // must exist
  country: Country;
  homeTown: string; // 1..100
  contactNo: string; // 5..20 of digits, space, + - ( )
  email: string; // valid email, max 254, stored lower-case
  gender: Gender;
  maritalStatus: MaritalStatus;
  dateOfBirth: IsoDate; // must be in the past
  /** Optional; default is first.last (lower-case, ASCII) plus a number if taken. */
  username?: string; // 3..50, [a-z0-9._-], unique case-insensitive
}

/** Same fields as create; username and role are not editable here. */
export type UpdateEmployeeInput = Omit<CreateEmployeeInput, 'username'>;

/** Shown once to HR after create / password reset. Never stored in plain text. */
export interface IssuedCredentials {
  username: string;
  temporaryPassword: string;
}

export interface CreateEmployeeResult {
  employee: EmployeeDetail;
  credentials: IssuedCredentials;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface EmployeeService {
  /** HR_ADMIN. All employees ordered by id ascending. */
  listEmployees(actor: Actor): Promise<EmployeeListItem[]>;

  /** HR_ADMIN. {id, "First Last"} ordered by first name, for pickers (appraisals). */
  listEmployeeOptions(actor: Actor): Promise<Option<EmployeeId>[]>;

  /**
   * HR_ADMIN: any employee. EMPLOYEE: only their own id; any other id throws
   * NOT_FOUND (not FORBIDDEN, so ids cannot be probed).
   * Throws NOT_FOUND if missing.
   */
  getEmployee(actor: Actor, id: EmployeeId): Promise<EmployeeDetail>;

  /** Any role. The actor's own record. NOT_FOUND if the account has no employee record. */
  getMyProfile(actor: Actor): Promise<EmployeeDetail>;

  /** HR_ADMIN. Data for the add/edit form. */
  getEmployeeFormOptions(actor: Actor): Promise<EmployeeFormOptions>;

  /**
   * HR_ADMIN. Creates the employee and an EMPLOYEE-role login account in one
   * transaction, with a random temporary password and mustChangePassword=true.
   * Throws VALIDATION (bad input, unknown department/position), CONFLICT (username taken).
   */
  createEmployee(actor: Actor, input: CreateEmployeeInput): Promise<CreateEmployeeResult>;

  /**
   * HR_ADMIN. Updates profile fields. Does NOT change the username
   * (legacy renamed the login to the new first name).
   * Throws NOT_FOUND, VALIDATION.
   */
  updateEmployee(actor: Actor, id: EmployeeId, input: UpdateEmployeeInput): Promise<EmployeeDetail>;

  /**
   * HR_ADMIN. Deletes the employee, their login account, leave requests and
   * appraisals in one transaction.
   * Throws NOT_FOUND; CONFLICT when deleting yourself or the last HR_ADMIN.
   */
  deleteEmployee(actor: Actor, id: EmployeeId): Promise<void>;

  /**
   * HR_ADMIN. NEW (not in legacy, pending director approval): issues a new
   * temporary password and sets mustChangePassword=true. Needed because new
   * accounts get a temporary password that HR may lose.
   * Throws NOT_FOUND (no employee or no account).
   */
  resetEmployeePassword(actor: Actor, id: EmployeeId): Promise<IssuedCredentials>;
}
