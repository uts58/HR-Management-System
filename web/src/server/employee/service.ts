import "server-only";

import { Role, type AccountAdminApi } from "@/contracts/auth";
import type { Actor, EmployeeId } from "@/contracts/common";
import {
  COUNTRIES,
  EMPLOYMENT_TYPES,
  GENDERS,
  MARITAL_STATUSES,
  type EmployeeDetail,
  type EmployeeListItem,
  type EmployeeService,
  type UpdateEmployeeInput,
} from "@/contracts/employee";
import type { Prisma } from "@/generated/prisma/client";
import {
  isoDateToUtcDate,
  toIsoDateOrNull,
  toIsoInstant,
  toIsoInstantOrNull,
} from "@/lib/dates";
import { entityIdSchema } from "@/lib/validation/common";
import {
  createEmployeeSchema,
  listEmployeesFilterSchema,
  updateEmployeeSchema,
} from "@/lib/validation/employee";
import { accountAdmin as defaultAccountAdmin } from "../account-admin-seam";
import { db, type Tx } from "../db";
import {
  conflictError,
  notFoundError,
  uniqueViolationToConflict,
  validationError,
} from "../errors";
import { assertRole, fullName, lockHrAdminSet } from "../shared";

export const MESSAGES = {
  notFound: "Employee not found.",
  noProfile: "Your account is not linked to an employee record.",
  terminatedEdit: "Terminated employees can't be edited.",
  terminatedReset: "Terminated employees can't have their password reset.",
  noAccount: "This employee has no login account.",
  terminateSelf: "You can't terminate your own account.",
  alreadyTerminated: "This employee is already terminated.",
  lastHrAdmin: "You can't terminate the last active HR admin.",
  usernameTaken: "This username is already taken",
  unknownDepartment: "Select an existing department",
  unknownPosition: "Select an existing position",
} as const;

const detailSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  contactNo: true,
  country: true,
  homeTown: true,
  gender: true,
  maritalStatus: true,
  dateOfBirth: true,
  employmentType: true,
  hireDate: true,
  employeeNumber: true,
  employmentStatus: true,
  terminatedAt: true,
  createdAt: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  user: { select: { username: true, emailIsPlaceholder: true } },
} as const satisfies Prisma.EmployeeSelect;

type DetailRow = Prisma.EmployeeGetPayload<{ select: typeof detailSelect }>;

function toDetail(r: DetailRow): EmployeeDetail {
  return {
    id: r.id,
    firstName: r.firstName,
    middleName: r.middleName,
    lastName: r.lastName,
    fullName: fullName(r),
    department: r.department
      ? { id: r.department.id, label: r.department.name }
      : null,
    position: r.position ? { id: r.position.id, label: r.position.name } : null,
    employmentType: r.employmentType,
    hireDate: toIsoDateOrNull(r.hireDate),
    employeeNumber: r.employeeNumber,
    country: r.country,
    homeTown: r.homeTown,
    contactNo: r.contactNo,
    email: r.email,
    emailIsPlaceholder: r.user?.emailIsPlaceholder ?? false,
    gender: r.gender,
    maritalStatus: r.maritalStatus,
    dateOfBirth: toIsoDateOrNull(r.dateOfBirth),
    username: r.user?.username ?? null,
    status: r.employmentStatus,
    terminatedAt: toIsoInstantOrNull(r.terminatedAt),
    createdAt: toIsoInstant(r.createdAt),
  };
}

function toEmployeeData(input: UpdateEmployeeInput) {
  return {
    firstName: input.firstName,
    middleName: input.middleName ?? null,
    lastName: input.lastName,
    departmentId: input.departmentId,
    positionId: input.positionId,
    employmentType: input.employmentType,
    hireDate: input.hireDate ? isoDateToUtcDate(input.hireDate) : null,
    employeeNumber: input.employeeNumber ?? null,
    country: input.country,
    homeTown: input.homeTown,
    contactNo: input.contactNo,
    email: input.email,
    gender: input.gender ?? null,
    maritalStatus: input.maritalStatus,
    dateOfBirth: isoDateToUtcDate(input.dateOfBirth),
  } satisfies Prisma.EmployeeUncheckedUpdateInput;
}

async function assertOrgRefs(
  tx: Tx,
  departmentId: number,
  positionId: number,
): Promise<void> {
  const department = await tx.department.findUnique({
    where: { id: departmentId },
    select: { id: true },
  });
  const position = await tx.position.findUnique({
    where: { id: positionId },
    select: { id: true },
  });
  const errors: Record<string, string[]> = {};
  if (!department) errors.departmentId = [MESSAGES.unknownDepartment];
  if (!position) errors.positionId = [MESSAGES.unknownPosition];
  if (Object.keys(errors).length > 0) throw validationError(errors);
}

const USERNAME_BASE_MAX = 27;

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function usernameBase(firstName: string, lastName: string): string {
  let base = [slug(firstName), slug(lastName)].filter(Boolean).join(".");
  if (base === "") base = "user";
  base = base.slice(0, USERNAME_BASE_MAX).replace(/\.+$/, "");
  if (base.length < 3) base = `${base}.user`;
  return base;
}

async function nextFreeUsername(tx: Tx, base: string): Promise<string> {
  const taken = new Set(
    (
      await tx.user.findMany({
        where: { username: { startsWith: base } },
        select: { username: true },
      })
    ).map((u) => u.username),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function createEmployeeService(
  accounts: AccountAdminApi = defaultAccountAdmin,
): EmployeeService {
  async function findVisibleDetail(id: number): Promise<DetailRow> {
    const row = await db.employee.findFirst({
      where: { id },
      select: detailSelect,
    });
    if (!row) throw notFoundError(MESSAGES.notFound);
    return row;
  }

  return {
    async listEmployees(actor, filter) {
      assertRole(actor, Role.HR_ADMIN);
      const { status } = listEmployeesFilterSchema.parse(filter ?? {});
      const rows = await db.employee.findMany({
        where: {
          ...(status === "ALL" ? {} : { employmentStatus: status }),
        },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          employmentStatus: true,
          terminatedAt: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
          user: { select: { role: true } },
        },
        orderBy: { id: "asc" },
      });
      return rows.map((r): EmployeeListItem => ({
        id: r.id,
        fullName: fullName(r),
        positionName: r.position?.name ?? null,
        departmentName: r.department?.name ?? null,
        email: r.email,
        role: r.user?.role ?? null,
        status: r.employmentStatus,
        terminatedAt: toIsoInstantOrNull(r.terminatedAt),
      }));
    },

    async listEmployeeOptions(actor) {
      assertRole(actor, Role.HR_ADMIN);
      const rows = await db.employee.findMany({
        where: { employmentStatus: "ACTIVE" },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
      });
      return rows.map((r) => ({ id: r.id, label: fullName(r) }));
    },

    async getEmployee(actor, rawId) {
      assertRole(actor, Role.HR_ADMIN, Role.EMPLOYEE);
      const id = entityIdSchema.parse(rawId);
      if (actor.role !== Role.HR_ADMIN && id !== actor.employeeId) {
        throw notFoundError(MESSAGES.notFound);
      }
      return toDetail(await findVisibleDetail(id));
    },

    async getMyProfile(actor) {
      assertRole(actor, Role.HR_ADMIN, Role.EMPLOYEE);
      if (actor.employeeId == null) throw notFoundError(MESSAGES.noProfile);
      return toDetail(await findVisibleDetail(actor.employeeId));
    },

    async getEmployeeFormOptions(actor) {
      assertRole(actor, Role.HR_ADMIN);
      const [departments, positions] = await Promise.all([
        db.department.findMany({
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
        }),
        db.position.findMany({
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
        }),
      ]);
      return {
        departments: departments.map((d) => ({ id: d.id, label: d.name })),
        positions: positions.map((p) => ({ id: p.id, label: p.name })),
        countries: COUNTRIES,
        genders: GENDERS,
        maritalStatuses: MARITAL_STATUSES,
        employmentTypes: EMPLOYMENT_TYPES,
      };
    },

    async createEmployee(actor, raw) {
      assertRole(actor, Role.HR_ADMIN);
      const input = createEmployeeSchema.parse(raw);
      try {
        return await db.$transaction(async (tx) => {
          await assertOrgRefs(tx, input.departmentId, input.positionId);

          let username: string;
          if (input.username) {
            const taken = await tx.user.findUnique({
              where: { username: input.username },
              select: { id: true },
            });
            if (taken) throw conflictError(MESSAGES.usernameTaken, "username");
            username = input.username;
          } else {
            username = await nextFreeUsername(
              tx,
              usernameBase(input.firstName, input.lastName),
            );
          }

          const employee = await tx.employee.create({
            data: { ...toEmployeeData(input), employmentStatus: "ACTIVE" },
            select: { id: true },
          });
          const { credentials } = await accounts.createLoginAccount(tx, {
            employeeId: employee.id,
            username,
            displayName: fullName(input),
            email: input.email,
            role: Role.EMPLOYEE,
          });
          const detail = await tx.employee.findUniqueOrThrow({
            where: { id: employee.id },
            select: detailSelect,
          });
          return { employee: toDetail(detail), credentials };
        });
      } catch (e) {
        throw (
          uniqueViolationToConflict(e, [
            "users_username_key",
            "employees_employee_number_key",
          ]) ?? e
        );
      }
    },

    async updateEmployee(actor, rawId, raw) {
      assertRole(actor, Role.HR_ADMIN);
      const id = entityIdSchema.parse(rawId);
      const input = updateEmployeeSchema.parse(raw);
      try {
        return await db.$transaction(async (tx) => {
          const current = await tx.employee.findFirst({
            where: { id },
            select: {
              employmentStatus: true,
              firstName: true,
              middleName: true,
              lastName: true,
              user: { select: { id: true } },
            },
          });
          if (!current) throw notFoundError(MESSAGES.notFound);
          if (current.employmentStatus === "TERMINATED") {
            throw conflictError(MESSAGES.terminatedEdit);
          }
          await assertOrgRefs(tx, input.departmentId, input.positionId);
          const { count } = await tx.employee.updateMany({
            where: { id, employmentStatus: "ACTIVE" },
            data: toEmployeeData(input),
          });
          if (count === 0) throw conflictError(MESSAGES.terminatedEdit);
          const newName = fullName(input);
          if (current.user && newName !== fullName(current)) {
            await accounts.updateDisplayName(tx, current.user.id, newName);
          }
          return toDetail(
            await tx.employee.findUniqueOrThrow({
              where: { id },
              select: detailSelect,
            }),
          );
        });
      } catch (e) {
        throw (
          uniqueViolationToConflict(e, ["employees_employee_number_key"]) ?? e
        );
      }
    },

    async terminateEmployee(actor: Actor, rawId: EmployeeId) {
      assertRole(actor, Role.HR_ADMIN);
      const id = entityIdSchema.parse(rawId);
      return db.$transaction(async (tx) => {
        await lockHrAdminSet(tx);

        const target = await tx.employee.findFirst({
          where: { id },
          select: {
            employmentStatus: true,
            user: { select: { id: true, role: true } },
          },
        });
        if (!target) throw notFoundError(MESSAGES.notFound);
        if (id === actor.employeeId)
          throw conflictError(MESSAGES.terminateSelf);
        if (target.employmentStatus === "TERMINATED") {
          throw conflictError(MESSAGES.alreadyTerminated);
        }
        if (target.user?.role === Role.HR_ADMIN) {
          const otherActiveAdmins = await tx.employee.count({
            where: {
              id: { not: id },
              employmentStatus: "ACTIVE",
              user: { role: Role.HR_ADMIN, disabledAt: null },
            },
          });
          if (otherActiveAdmins === 0) {
            throw conflictError(MESSAGES.lastHrAdmin);
          }
        }

        const now = new Date();
        await tx.employee.update({
          where: { id },
          data: { employmentStatus: "TERMINATED", terminatedAt: now },
        });
        if (target.user) await accounts.disableLogin(tx, target.user.id);
        await tx.leaveRequest.updateMany({
          where: { employeeId: id, status: "PENDING" },
          data: {
            status: "REJECTED",
            decidedAt: now,
            decidedById: actor.userId,
            seenByEmployee: false,
          },
        });
        return toDetail(
          await tx.employee.findUniqueOrThrow({
            where: { id },
            select: detailSelect,
          }),
        );
      });
    },

    async resetEmployeePassword(actor, rawId) {
      assertRole(actor, Role.HR_ADMIN);
      const id = entityIdSchema.parse(rawId);
      return db.$transaction(async (tx) => {
        const target = await tx.employee.findFirst({
          where: { id },
          select: { employmentStatus: true, user: { select: { id: true } } },
        });
        if (!target) throw notFoundError(MESSAGES.notFound);
        if (target.employmentStatus === "TERMINATED") {
          throw conflictError(MESSAGES.terminatedReset);
        }
        if (!target.user) throw notFoundError(MESSAGES.noAccount);
        return accounts.issueTemporaryPassword(tx, target.user.id);
      });
    },
  };
}

export const employeeService: EmployeeService = createEmployeeService();
