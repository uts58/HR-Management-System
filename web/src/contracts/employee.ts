import type {
  Actor,
  DepartmentId,
  EmployeeId,
  IsoDate,
  Option,
  PositionId,
  UtcTimestamp,
} from "./common";
import type { IssuedCredentials, Role } from "./auth";

export const GENDERS = [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "PREFER_NOT_TO_SAY",
] as const;
export type Gender = (typeof GENDERS)[number];

export const MARITAL_STATUSES = ["SINGLE", "MARRIED", "DIVORCED"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const COUNTRIES = [
  "Bangladesh",
  "Nepal",
  "India",
  "Pakistan",
  "USA",
  "Germany",
  "Canada",
  "Australia",
] as const;
export type Country = (typeof COUNTRIES)[number];

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACTOR",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const DEFAULT_EMPLOYMENT_TYPE: EmploymentType = "FULL_TIME";

export const EMPLOYEE_NUMBER_MAX = 50;

export const EMPLOYMENT_STATUSES = ["ACTIVE", "TERMINATED"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export type EmployeeStatusFilter = EmploymentStatus | "ALL";

export const USERNAME_PATTERN = "^[a-z0-9._]{3,30}$";

export interface EmployeeListItem {
  id: EmployeeId;
  fullName: string;
  positionName: string | null;
  departmentName: string | null;
  email: string | null;
  role: Role | null;
  status: EmploymentStatus;
  terminatedAt: UtcTimestamp | null;
}

export interface EmployeeDetail {
  id: EmployeeId;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  department: Option<DepartmentId> | null;
  position: Option<PositionId> | null;
  employmentType: EmploymentType;
  hireDate: IsoDate | null;
  employeeNumber: string | null;
  country: string | null;
  homeTown: string | null;
  contactNo: string | null;
  email: string | null;
  emailIsPlaceholder: boolean;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  dateOfBirth: IsoDate | null;
  username: string | null;
  status: EmploymentStatus;
  terminatedAt: UtcTimestamp | null;
  createdAt: UtcTimestamp;
}

export interface EmployeeRef {
  id: EmployeeId;
  name: string;
  status: EmploymentStatus;
}

export interface EmployeeFormOptions {
  departments: Option<DepartmentId>[];
  positions: Option<PositionId>[];
  countries: readonly Country[];
  genders: readonly Gender[];
  maritalStatuses: readonly MaritalStatus[];
  employmentTypes: readonly EmploymentType[];
}

export interface CreateEmployeeInput {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  departmentId: DepartmentId;
  positionId: PositionId;
  employmentType: EmploymentType;
  hireDate?: IsoDate | null;
  employeeNumber?: string | null;
  country: Country;
  homeTown: string;
  contactNo: string;
  email: string;
  gender?: Gender | null;
  maritalStatus: MaritalStatus;
  dateOfBirth: IsoDate;
  username?: string;
}

export type UpdateEmployeeInput = Omit<CreateEmployeeInput, "username">;

export interface CreateEmployeeResult {
  employee: EmployeeDetail;
  credentials: IssuedCredentials;
}

export interface EmployeeService {
  listEmployees(
    actor: Actor,
    filter?: { status?: EmployeeStatusFilter },
  ): Promise<EmployeeListItem[]>;

  listEmployeeOptions(actor: Actor): Promise<Option<EmployeeId>[]>;

  getEmployee(actor: Actor, id: EmployeeId): Promise<EmployeeDetail>;

  getMyProfile(actor: Actor): Promise<EmployeeDetail>;

  getEmployeeFormOptions(actor: Actor): Promise<EmployeeFormOptions>;

  createEmployee(
    actor: Actor,
    input: CreateEmployeeInput,
  ): Promise<CreateEmployeeResult>;

  updateEmployee(
    actor: Actor,
    id: EmployeeId,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeDetail>;

  terminateEmployee(actor: Actor, id: EmployeeId): Promise<EmployeeDetail>;

  resetEmployeePassword(
    actor: Actor,
    id: EmployeeId,
  ): Promise<IssuedCredentials>;
}
