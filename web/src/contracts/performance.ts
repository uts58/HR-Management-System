/**
 * Performance appraisal contract. Implemented by Backend in web/src/server/performance/.
 * Business rules: docs/architecture/contracts.md#performance
 */

import type { Actor, AppraisalId, EmployeeId, IsoDate, Timestamp } from './common';

/** Legacy rating select, 1..5. */
export const RATINGS = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_LABELS: Readonly<Record<Rating, string>> = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

export interface Appraisal {
  id: AppraisalId;
  employeeId: EmployeeId;
  employeeName: string; // "Unknown employee" for legacy orphan rows
  projectName: string | null; // nullable for legacy rows
  projectStart: IsoDate | null;
  projectEnd: IsoDate | null;
  rating: Rating | null;
  createdAt: Timestamp | null; // null for migrated rows
}

export interface CreateAppraisalInput {
  employeeId: EmployeeId; // must exist
  projectName: string; // trimmed, 1..200
  projectStart: IsoDate;
  projectEnd: IsoDate; // >= projectStart
  rating: Rating;
}

export interface PerformanceService {
  /** HR_ADMIN. All appraisals, newest first. */
  listAppraisals(actor: Actor): Promise<Appraisal[]>;

  /** HR_ADMIN. Throws VALIDATION (incl. unknown employee). */
  createAppraisal(actor: Actor, input: CreateAppraisalInput): Promise<Appraisal>;

  /** HR_ADMIN. Throws NOT_FOUND. */
  deleteAppraisal(actor: Actor, id: AppraisalId): Promise<void>;
}
