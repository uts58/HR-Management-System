import type {
  Actor,
  AppraisalId,
  EmployeeId,
  IsoDate,
  UtcTimestamp,
} from "./common";
import type { EmployeeRef } from "./employee";

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
  employee: EmployeeRef;
  projectName: string | null;
  projectStart: IsoDate | null;
  projectEnd: IsoDate | null;
  rating: Rating | null;
  createdAt: UtcTimestamp | null;
}

export interface CreateAppraisalInput {
  employeeId: EmployeeId;
  projectName: string;
  projectStart: IsoDate;
  projectEnd: IsoDate;
  rating: Rating;
}

export interface PerformanceService {
  listAppraisals(actor: Actor): Promise<Appraisal[]>;

  createAppraisal(
    actor: Actor,
    input: CreateAppraisalInput,
  ): Promise<Appraisal>;

  deleteAppraisal(actor: Actor, id: AppraisalId): Promise<void>;
}
