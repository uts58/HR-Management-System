import type { Gender, MaritalStatus, NoticeType } from "@/contracts";

/** Display labels for contract enums that have no label map in contracts/. */
export const GENDER_LABELS: Readonly<Record<Gender, string>> = {
  MALE: "Male",
  FEMALE: "Female",
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
