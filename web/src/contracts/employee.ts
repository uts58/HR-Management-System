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
import type { IssuedCredentials, Role } from './auth';

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

/**
 * Employment status. Employees are never hard-deleted in v1: HR terminates
 * them, which blocks login and hides them from default lists while keeping
 * their leave and appraisal history.
 */
export const EMPLOYMENT_STATUSES = ['ACTIVE', 'TERMINATED'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** Filter for the HR employee list. Default 'ACTIVE'. */
export type EmployeeStatusFilter = EmploymentStatus | 'ALL';

// ─── Read models ──────────────────────────────────────────────────────────────

/** Row on the HR "Manage Employees" table. */
export interface EmployeeListItem {
  id: EmployeeId;
  fullName: string; // "First Middle Last", middle omitted when empty
  positionName: string | null;
  departmentName: string | null;
  email: string | null;
  role: Role | null; // null when the employee has no login account
  status: EmploymentStatus;
  terminatedAt: Timestamp | null;
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
  status: EmploymentStatus;
  terminatedAt: Timestamp | null;
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

export interface CreateEmployeeResult {
  employee: EmployeeDetail;
  credentials: IssuedCredentials;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface EmployeeService {
  /**
   * HR_ADMIN. Employees ordered by id ascending, filtered by status
   * (default 'ACTIVE'; terminated employees are hidden unless asked for).
   */
  listEmployees(
    actor: Actor,
    filter?: { status?: EmployeeStatusFilter },
  ): Promise<EmployeeListItem[]>;

  /** HR_ADMIN. ACTIVE employees only, {id, "First Last"} by first name, for pickers (appraisals). */
  listEmployeeOptions(actor: Actor): Promise<Option<EmployeeId>[]>;

  /**
   * HR_ADMIN: any employee, including TERMINATED. EMPLOYEE: only their own id; any other id throws
   * NOT_FOUND (not FORBIDDEN, so ids cannot be probed).
   * Throws NOT_FOUND if missing.
   */
  getEmployee(actor: Actor, id: EmployeeId): Promise<EmployeeDetail>;

  /** Any role. The actor's own record. NOT_FOUND if the account has no employee record. */
  getMyProfile(actor: Actor): Promise<EmployeeDetail>;

  /** HR_ADMIN. Data for the add/edit form. */
  getEmployeeFormOptions(actor: Actor): Promise<EmployeeFormOptions>;

  /**
   * HR_ADMIN. Creates an ACTIVE employee and an EMPLOYEE-role login account in
   * one transaction (via AccountAdminApi.createLoginAccount), with a random
   * temporary password and mustChangePassword=true.
   * Throws VALIDATION (bad input, unknown department/position), CONFLICT (username taken).
   */
  createEmployee(actor: Actor, input: CreateEmployeeInput): Promise<CreateEmployeeResult>;

  /**
   * HR_ADMIN. Updates profile fields. Does NOT change the username
   * (legacy renamed the login to the new first name).
   * Throws NOT_FOUND, VALIDATION; CONFLICT if the employee is TERMINATED.
   */
  updateEmployee(actor: Actor, id: EmployeeId, input: UpdateEmployeeInput): Promise<EmployeeDetail>;

  /**
   * HR_ADMIN. Soft delete (replaces legacy hard delete). In one transaction:
   * status=TERMINATED, terminatedAt=now, login disabled and all sessions
   * revoked (AccountAdminApi.disableLogin), and the employee's PENDING leave
   * requests set to REJECTED. Leave and appraisal history is kept.
   * There is no hard delete and no reinstatement in v1.
   * Throws NOT_FOUND; CONFLICT when terminating yourself, the last active
   * HR_ADMIN, or an already TERMINATED employee.
   */
  terminateEmployee(actor: Actor, id: EmployeeId): Promise<EmployeeDetail>;

  /**
   * HR_ADMIN. NEW (approved): issues a new temporary password, sets
   * mustChangePassword=true and revokes the user's sessions
   * (AccountAdminApi.issueTemporaryPassword).
   * Throws NOT_FOUND (no employee or no account); CONFLICT if TERMINATED.
   */
  resetEmployeePassword(actor: Actor, id: EmployeeId): Promise<IssuedCredentials>;
}
