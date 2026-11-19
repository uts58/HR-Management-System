/**
 * Performance appraisal contract.
 * Implemented by Backend in web/src/server/performance/.
 * Business rules: docs/architecture/contracts.md#performance
 */

import type {
  Actor,
  AppraisalId,
  EmployeeId,
  IsoDate,
  UtcTimestamp,
} from "./common";
import type { EmployeeRef } from "./employee";

/** Legacy rating select, 1..5. */
export const RATINGS = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_LABELS: Readonly<Record<Rating, string>> = {
  1: "Poor",
  2: "Below Average",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

export interface Appraisal {
  id: AppraisalId;
  /** "Unknown employee #<id>" for placeholder employees (legacy orphans). */
  employee: EmployeeRef;
  projectName: string | null; // nullable for legacy rows
  projectStart: IsoDate | null; // null when legacy text was unparseable
  projectEnd: IsoDate | null;
  rating: Rating | null;
  createdAt: UtcTimestamp | null; // null for migrated rows
}

export interface CreateAppraisalInput {
  employeeId: EmployeeId; // must exist, be ACTIVE and not a placeholder
  projectName: string; // trimmed, 1..200
  projectStart: IsoDate;
  projectEnd: IsoDate; // >= projectStart
  rating: Rating;
}

export interface PerformanceService {
  /** HR_ADMIN. All appraisals (placeholder history included), newest first. */
  listAppraisals(actor: Actor): Promise<Appraisal[]>;

  /**
   * HR_ADMIN. Throws VALIDATION (incl. unknown, TERMINATED or placeholder
   * employee).
   */
  createAppraisal(
    actor: Actor,
    input: CreateAppraisalInput,
  ): Promise<Appraisal>;

  /** HR_ADMIN. Throws NOT_FOUND. */
  deleteAppraisal(actor: Actor, id: AppraisalId): Promise<void>;
}
