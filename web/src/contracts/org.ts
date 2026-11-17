/**
 * Org domain contract: departments and positions.
 * Implemented by Backend in web/src/server/org/.
 * Business rules: docs/architecture/contracts.md#org
 */

import type { Actor, DepartmentId, PositionId } from './common';

export interface Department {
  id: DepartmentId;
  name: string;
  /** Employees currently assigned; the UI disables Delete when > 0. */
  employeeCount: number;
}

export interface Position {
  id: PositionId;
  name: string;
  employeeCount: number;
}

/** Name: trimmed, 1..100 chars, unique case-insensitive within its table. */
export interface CreateDepartmentInput {
  name: string;
}

export interface CreatePositionInput {
  name: string;
}

export interface OrgService {
  /** HR_ADMIN. Ordered by id ascending (legacy parity). */
  listDepartments(actor: Actor): Promise<Department[]>;

  /** HR_ADMIN. Throws VALIDATION (empty/too long), CONFLICT (duplicate name). */
  createDepartment(actor: Actor, input: CreateDepartmentInput): Promise<Department>;

  /**
   * HR_ADMIN. Throws NOT_FOUND; CONFLICT when employees are assigned
   * (legacy deleted anyway and left employees pointing at a missing department).
   */
  deleteDepartment(actor: Actor, id: DepartmentId): Promise<void>;

  /** HR_ADMIN. Ordered by id ascending. */
  listPositions(actor: Actor): Promise<Position[]>;

  /** HR_ADMIN. Throws VALIDATION, CONFLICT (duplicate name). */
  createPosition(actor: Actor, input: CreatePositionInput): Promise<Position>;

  /** HR_ADMIN. Throws NOT_FOUND; CONFLICT when employees hold the position. */
  deletePosition(actor: Actor, id: PositionId): Promise<void>;
}
