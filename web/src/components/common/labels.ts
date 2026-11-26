import type {
  EmploymentType,
  Gender,
  MaritalStatus,
  NoticeType,
} from "@/contracts";

export const GENDER_LABELS: Readonly<Record<Gender, string>> = {
  MALE: "Male",
  FEMALE: "Female",
  NON_BINARY: "Non-binary",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};

export const EMPLOYMENT_TYPE_LABELS: Readonly<Record<EmploymentType, string>> =
  {
    FULL_TIME: "Full-time",
    PART_TIME: "Part-time",
    CONTRACTOR: "Contractor",
  };

export const MARITAL_STATUS_LABELS: Readonly<Record<MaritalStatus, string>> = {
  SINGLE: "Single",
  MARRIED: "Married",
  DIVORCED: "Divorced",
};

export const NOTICE_TYPE_LABELS: Readonly<Record<NoticeType, string>> = {
  GENERAL: "General",
  URGENT: "Urgent",
  HOLIDAY: "Holiday",
};
