import type { Actor, DepartmentId, PositionId } from "./common";

export interface Department {
  id: DepartmentId;
  name: string;
  employeeCount: number;
  totalEmployeeCount: number;
}

export interface Position {
  id: PositionId;
  name: string;
  employeeCount: number;
  totalEmployeeCount: number;
}

export interface CreateDepartmentInput {
  name: string;
}

export interface CreatePositionInput {
  name: string;
}

export interface OrgService {
  listDepartments(actor: Actor): Promise<Department[]>;

  createDepartment(
    actor: Actor,
    input: CreateDepartmentInput,
  ): Promise<Department>;

  deleteDepartment(actor: Actor, id: DepartmentId): Promise<void>;

  listPositions(actor: Actor): Promise<Position[]>;

  createPosition(actor: Actor, input: CreatePositionInput): Promise<Position>;

  deletePosition(actor: Actor, id: PositionId): Promise<void>;
}
