import { LEAVE_TYPE_LABELS, type LeaveRequest } from "@/contracts";

/** Leave type label. */
export function LeaveTypeText({
  request,
}: {
  request: Pick<LeaveRequest, "leaveType">;
}) {
  return <span>{LEAVE_TYPE_LABELS[request.leaveType]}</span>;
}
