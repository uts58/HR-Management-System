/**
 * Org domain contract: departments and positions.
 * Implemented by Backend in web/src/server/org/.
 * Business rules: docs/architecture/contracts.md#org
 */

import type { Actor, DepartmentId, PositionId } from "./common";

export interface Department {
  id: DepartmentId;
  name: string;
  /** ACTIVE, non-placeholder employees assigned. */
  employeeCount: number;
  /**
   * All non-placeholder employees referencing it, TERMINATED included.
   * The UI disables Delete when > 0.
   */
  totalEmployeeCount: number;
}

export interface Position {
  id: PositionId;
  name: string;
  employeeCount: number;
  totalEmployeeCount: number;
}

/**
 * Name: trimmed, 1..100 chars, unique case-insensitive within its table.
 * Uniqueness is enforced by a hand-written unique index on lower(name)
 * (Data); services map that unique violation to CONFLICT on field `name`.
 */
export interface CreateDepartmentInput {
  name: string;
}

export interface CreatePositionInput {
  name: string;
}

export interface OrgService {
  /** HR_ADMIN. Ordered by id ascending (legacy parity). */
  listDepartments(actor: Actor): Promise<Department[]>;

  /**
   * HR_ADMIN. Throws VALIDATION (empty/too long), CONFLICT (duplicate name,
   * including a race caught by the lower(name) index).
   */
  createDepartment(
    actor: Actor,
    input: CreateDepartmentInput,
  ): Promise<Department>;

  /**
   * HR_ADMIN. Throws NOT_FOUND; CONFLICT when any employee references it,
   * TERMINATED ones included (their history keeps the reference). Legacy
   * deleted anyway and left employees pointing at a missing department.
   */
  deleteDepartment(actor: Actor, id: DepartmentId): Promise<void>;

  /** HR_ADMIN. Ordered by id ascending. */
  listPositions(actor: Actor): Promise<Position[]>;

  /** HR_ADMIN. Throws VALIDATION, CONFLICT (duplicate name). */
  createPosition(actor: Actor, input: CreatePositionInput): Promise<Position>;

  /**
   * HR_ADMIN. Throws NOT_FOUND; CONFLICT when any employee (incl.
   * TERMINATED) references it.
   */
  deletePosition(actor: Actor, id: PositionId): Promise<void>;
}
