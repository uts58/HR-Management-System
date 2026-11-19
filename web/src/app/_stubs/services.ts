/**
 * STUB SEAMS (Phase 1a). One function per contract service function, with
 * the same name plus `Stub` and the same arguments minus `actor`. Each page
 * calls exactly one of these per piece of data, so wiring is a one-line
 * swap, e.g.
 *
 *   const employees = await listEmployeesStub({ status });
 *   // becomes
 *   const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
 *   const employees = await employeeService.listEmployees(toActor(session), { status });
 *
 * Differences from the real services, on purpose:
 * - "Not found" returns null here; the real service throws
 *   ServiceError('NOT_FOUND') and the page turns that into notFound().
 * - No role checks. The real pages call requireRole() first (ADR-0004).
 */

import type {
  Appraisal,
  Department,
  EmployeeDetail,
  EmployeeFormOptions,
  EmployeeId,
  EmployeeListItem,
  EmployeeStatusFilter,
  LeaveRequest,
  Notice,
  Option,
  Position,
} from "@/contracts";
import { COUNTRIES, GENDERS, MARITAL_STATUSES } from "@/contracts";

import {
  appraisals,
  departments,
  employeeRoles,
  employees,
  leaveRequests,
  notices,
  positions,
} from "./fixtures";
import { getSessionStub } from "./session";

const fullName = (e: EmployeeDetail) =>
  [e.firstName, e.middleName, e.lastName].filter(Boolean).join(" ");

// ─── Employee (contracts/employee.ts → EmployeeService) ─────────────────────

/** → employeeService.listEmployees(actor, { status }) */
export async function listEmployeesStub(filter?: {
  status?: EmployeeStatusFilter;
}): Promise<EmployeeListItem[]> {
  const status = filter?.status ?? "ACTIVE";
  return employees
    .filter((e) => status === "ALL" || e.status === status)
    .sort((a, b) => a.id - b.id)
    .map((e) => ({
      id: e.id,
      fullName: fullName(e),
      positionName: e.position?.label ?? null,
      departmentName: e.department?.label ?? null,
      email: e.email,
      role: employeeRoles[e.id] ?? null,
      status: e.status,
      terminatedAt: e.terminatedAt,
    }));
}

/** → employeeService.listEmployeeOptions(actor) */
export async function listEmployeeOptionsStub(): Promise<Option<EmployeeId>[]> {
  return employees
    .filter((e) => e.status === "ACTIVE")
    .sort((a, b) => a.firstName.localeCompare(b.firstName))
    .map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName}` }));
}

/** → employeeService.getEmployee(actor, id). null stands in for NOT_FOUND. */
export async function getEmployeeStub(
  id: EmployeeId,
): Promise<EmployeeDetail | null> {
  return employees.find((e) => e.id === id) ?? null;
}

/** → employeeService.getMyProfile(actor). null stands in for NOT_FOUND. */
export async function getMyProfileStub(): Promise<EmployeeDetail | null> {
  const session = await getSessionStub();
  return employees.find((e) => e.id === session.user.employeeId) ?? null;
}

/** → employeeService.getEmployeeFormOptions(actor) */
export async function getEmployeeFormOptionsStub(): Promise<EmployeeFormOptions> {
  return {
    departments: departments.map((d) => ({ id: d.id, label: d.name })),
    positions: positions.map((p) => ({ id: p.id, label: p.name })),
    countries: COUNTRIES,
    genders: GENDERS,
    maritalStatuses: MARITAL_STATUSES,
  };
}

// ─── Org (contracts/org.ts → OrgService) ────────────────────────────────────

/** → orgService.listDepartments(actor) */
export async function listDepartmentsStub(): Promise<Department[]> {
  return departments;
}

/** → orgService.listPositions(actor) */
export async function listPositionsStub(): Promise<Position[]> {
  return positions;
}

// ─── Leave (contracts/leave.ts → LeaveService) ──────────────────────────────

/** → leaveService.listMyLeaveRequests(actor) */
export async function listMyLeaveRequestsStub(): Promise<LeaveRequest[]> {
  const session = await getSessionStub();
  return leaveRequests
    .filter((r) => r.employee.id === session.user.employeeId)
    .map((r) => ({ ...r, legacyLeaveType: null }));
}

/** → leaveService.countMyUnseenDecisions(actor) */
export async function countMyUnseenDecisionsStub(): Promise<number> {
  const mine = await listMyLeaveRequestsStub();
  return mine.filter((r) => r.status !== "PENDING" && !r.seenByEmployee).length;
}

/** → leaveService.listPendingLeaveRequests(actor) (oldest first) */
export async function listPendingLeaveRequestsStub(): Promise<LeaveRequest[]> {
  return leaveRequests.filter((r) => r.status === "PENDING").reverse();
}

/** → leaveService.listAllLeaveRequests(actor) (newest first) */
export async function listAllLeaveRequestsStub(): Promise<LeaveRequest[]> {
  return leaveRequests;
}

/** → leaveService.countPendingLeaveRequests(actor) */
export async function countPendingLeaveRequestsStub(): Promise<number> {
  return leaveRequests.filter((r) => r.status === "PENDING").length;
}

// ─── Notice (contracts/notice.ts → NoticeService) ───────────────────────────

/** → noticeService.listRecentNotices(actor, limit) */
export async function listRecentNoticesStub(limit = 5): Promise<Notice[]> {
  return notices.slice(0, limit);
}

/** → noticeService.listNotices(actor) */
export async function listNoticesStub(): Promise<Notice[]> {
  return notices;
}

// ─── Performance (contracts/performance.ts → PerformanceService) ────────────

/** → performanceService.listAppraisals(actor) */
export async function listAppraisalsStub(): Promise<Appraisal[]> {
  return appraisals;
}
