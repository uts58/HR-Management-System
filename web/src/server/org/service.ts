/**
 * Departments and positions (contracts.md#org).
 *
 * - Names are unique case-insensitively via Data's hand-written
 *   `lower(name)` indexes. The service checks first (same `lower()` the
 *   index uses) and also maps the index's P2002 from the insert (a race) to
 *   the same CONFLICT on `name`.
 * - Deleting an in-use row is CONFLICT ("N employees are assigned…").
 *   Terminated employees count. The service checks first and also converts
 *   a P2003 from the delete itself (a race) into the same CONFLICT.
 */

import "server-only";

import { Role } from "@/contracts/auth";
import type { Actor, DepartmentId, PositionId } from "@/contracts/common";
import type { Department, OrgService, Position } from "@/contracts/org";
import { entityIdSchema } from "@/lib/validation/common";
import {
  createDepartmentSchema,
  createPositionSchema,
} from "@/lib/validation/org";
import { db } from "../db";
import {
  conflictError,
  isForeignKeyViolation,
  isPrismaKnownError,
  notFoundError,
  uniqueViolationToConflict,
} from "../errors";
import { NOT_PLACEHOLDER, assertRole } from "../shared";

type Kind = "department" | "position";

const LABEL: Record<Kind, string> = {
  department: "department",
  position: "position",
};

export function duplicateNameMessage(kind: Kind): string {
  return `A ${LABEL[kind]} with this name already exists`;
}

export function inUseMessage(kind: Kind, count: number): string {
  const who = count === 1 ? "1 employee is" : `${count} employees are`;
  return `${who} assigned to this ${LABEL[kind]}. Reassign them first.`;
}

const FK_FIELD = {
  department: "departmentId",
  position: "positionId",
} as const;
const UNIQUE_INDEX = {
  department: "departments_name_lower_key",
  position: "positions_name_lower_key",
} as const;

/** employeeCount (ACTIVE) and totalEmployeeCount per id, placeholders excluded. */
async function countsBy(
  kind: Kind,
): Promise<Map<number, { active: number; total: number }>> {
  const field = FK_FIELD[kind];
  const rows = await db.employee.groupBy({
    by: [field, "employmentStatus"],
    where: { ...NOT_PLACEHOLDER, [field]: { not: null } },
    _count: { _all: true },
  });
  const counts = new Map<number, { active: number; total: number }>();
  for (const row of rows) {
    const id = row[field];
    if (id == null) continue;
    const c = counts.get(id) ?? { active: 0, total: 0 };
    c.total += row._count._all;
    if (row.employmentStatus === "ACTIVE") c.active += row._count._all;
    counts.set(id, c);
  }
  return counts;
}

async function list(kind: Kind): Promise<Department[]> {
  const rows =
    kind === "department"
      ? await db.department.findMany({
          select: { id: true, name: true },
          orderBy: { id: "asc" },
        })
      : await db.position.findMany({
          select: { id: true, name: true },
          orderBy: { id: "asc" },
        });
  const counts = await countsBy(kind);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    employeeCount: counts.get(r.id)?.active ?? 0,
    totalEmployeeCount: counts.get(r.id)?.total ?? 0,
  }));
}

async function nameTaken(kind: Kind, name: string): Promise<boolean> {
  // Same expression as the unique index, so the check and the index agree.
  const rows =
    kind === "department"
      ? await db.$queryRaw<{ id: number }[]>`
          SELECT id FROM departments WHERE lower(name) = lower(${name}) LIMIT 1`
      : await db.$queryRaw<{ id: number }[]>`
          SELECT id FROM positions WHERE lower(name) = lower(${name}) LIMIT 1`;
  return rows.length > 0;
}

async function create(kind: Kind, name: string): Promise<Department> {
  if (await nameTaken(kind, name)) {
    throw conflictError(duplicateNameMessage(kind), "name");
  }
  try {
    const row =
      kind === "department"
        ? await db.department.create({
            data: { name },
            select: { id: true, name: true },
          })
        : await db.position.create({
            data: { name },
            select: { id: true, name: true },
          });
    return { ...row, employeeCount: 0, totalEmployeeCount: 0 };
  } catch (e) {
    throw uniqueViolationToConflict(e, [UNIQUE_INDEX[kind]]) ?? e;
  }
}

/** Every employee referencing the row blocks the delete (FK is Restrict). */
async function referenceCount(kind: Kind, id: number): Promise<number> {
  return db.employee.count({ where: { [FK_FIELD[kind]]: id } });
}

async function remove(kind: Kind, rawId: unknown): Promise<void> {
  const id = entityIdSchema.parse(rawId);
  const exists =
    kind === "department"
      ? await db.department.findUnique({ where: { id }, select: { id: true } })
      : await db.position.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFoundError(`This ${LABEL[kind]} was not found.`);

  const inUse = await referenceCount(kind, id);
  if (inUse > 0) throw conflictError(inUseMessage(kind, inUse));

  try {
    if (kind === "department") await db.department.delete({ where: { id } });
    else await db.position.delete({ where: { id } });
  } catch (e) {
    if (isForeignKeyViolation(e)) {
      // An employee was assigned between the check and the delete.
      const now = await referenceCount(kind, id);
      throw conflictError(inUseMessage(kind, Math.max(now, 1)), undefined, {
        cause: e,
      });
    }
    if (isPrismaKnownError(e, "P2025")) {
      throw notFoundError(`This ${LABEL[kind]} was not found.`);
    }
    throw e;
  }
}

export const orgService: OrgService = {
  async listDepartments(actor: Actor): Promise<Department[]> {
    assertRole(actor, Role.HR_ADMIN);
    return list("department");
  },

  async createDepartment(actor, input): Promise<Department> {
    assertRole(actor, Role.HR_ADMIN);
    const { name } = createDepartmentSchema.parse(input);
    return create("department", name);
  },

  async deleteDepartment(actor, id: DepartmentId): Promise<void> {
    assertRole(actor, Role.HR_ADMIN);
    await remove("department", id);
  },

  async listPositions(actor): Promise<Position[]> {
    assertRole(actor, Role.HR_ADMIN);
    return list("position");
  },

  async createPosition(actor, input): Promise<Position> {
    assertRole(actor, Role.HR_ADMIN);
    const { name } = createPositionSchema.parse(input);
    return create("position", name);
  },

  async deletePosition(actor, id: PositionId): Promise<void> {
    assertRole(actor, Role.HR_ADMIN);
    await remove("position", id);
  },
};
