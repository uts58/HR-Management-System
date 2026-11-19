import { LEAVE_TYPE_LABELS, type LeaveRequest } from "@/contracts";

/**
 * Leave type label. Migrated OTHER rows also show the original legacy text
 * (HR read models only; it is null in an employee's own list).
 */
export function LeaveTypeText({
  request,
}: {
  request: Pick<LeaveRequest, "leaveType" | "legacyLeaveType">;
}) {
  return (
    <span>
      {LEAVE_TYPE_LABELS[request.leaveType]}
      {request.leaveType === "OTHER" && request.legacyLeaveType && (
        <span className="block text-xs text-muted-foreground">
          Legacy: “{request.legacyLeaveType}”
        </span>
      )}
    </span>
  );
}
