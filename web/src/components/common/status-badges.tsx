import { cn } from "cn";
import type { ReactNode } from "react";

import type {
  EmployeeRef,
  EmploymentStatus,
  LeaveStatus,
  NoticeType,
  Role,
} from "@/contracts";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-success/25 bg-success/12 text-success",
  warning: "border-warning/25 bg-warning/12 text-warning",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  info: "border-info/25 bg-info/12 text-info",
  primary: "border-primary/25 bg-primary/10 text-primary",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const LEAVE_STATUS: Record<LeaveStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const { label, tone } = LEAVE_STATUS[status];
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

export function SelfDecidedBadge({
  request,
}: {
  request: { status: LeaveStatus; selfApproved: boolean };
}) {
  if (!request.selfApproved || request.status === "PENDING") return null;
  return (
    <StatusPill tone="warning">
      {request.status === "APPROVED" ? "Self-approved" : "Self-rejected"}
    </StatusPill>
  );
}

export function EmploymentStatusBadge({
  status,
}: {
  status: EmploymentStatus;
}) {
  return status === "ACTIVE" ? (
    <StatusPill tone="success">Active</StatusPill>
  ) : (
    <StatusPill tone="neutral">Terminated</StatusPill>
  );
}

export function RoleBadge({ role }: { role: Role | null }) {
  if (role === "HR_ADMIN")
    return <StatusPill tone="primary">HR admin</StatusPill>;
  if (role === "EMPLOYEE") return <StatusPill>Employee</StatusPill>;
  return <StatusPill>No login</StatusPill>;
}

const NOTICE_TYPE: Record<NoticeType, { label: string; tone: Tone }> = {
  GENERAL: { label: "General", tone: "neutral" },
  URGENT: { label: "Urgent", tone: "danger" },
  HOLIDAY: { label: "Holiday", tone: "info" },
};

export function NoticeTypeBadge({ type }: { type: NoticeType }) {
  const { label, tone } = NOTICE_TYPE[type];
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

export function EmployeeRefName({ employee }: { employee: EmployeeRef }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{employee.name}</span>
      {employee.status === "TERMINATED" && (
        <StatusPill tone="neutral">Terminated</StatusPill>
      )}
    </span>
  );
}
