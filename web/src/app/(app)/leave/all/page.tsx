import { CalendarCheckIcon } from "lucide-react";
import type { Metadata } from "next";

import { CalendarDateRange } from "@/components/calendar-date";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import {
  EmployeeRefName,
  LeaveStatusBadge,
} from "@/components/common/status-badges";
import { LocalTime } from "@/components/local-time";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Role, requireRole } from "@/auth";
import { toActor } from "@/server/action";
import { leaveService } from "@/server/leave/service";
import { LeaveTypeText } from "../_components/leave-type-text";

export const metadata: Metadata = { title: "All leave" };

/** Feature map row 29 (legacy /viewLeavebyAdmin). HR only. Newest first. */
export default async function AllLeavePage() {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const requests = await leaveService.listAllLeaveRequests(actor);

  return (
    <>
      <PageHeader
        title="All leave requests"
        description="Every request, newest first, including history for terminated employees."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "All leave" },
        ]}
      />
      {requests.length === 0 ? (
        <EmptyState icon={CalendarCheckIcon} title="No leave requests found" />
      ) : (
        <Card className="py-0">
          <Table>
            <caption className="sr-only">
              All leave requests, newest first
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-4">
                  Employee
                </TableHead>
                <TableHead scope="col">Type</TableHead>
                <TableHead scope="col">Dates</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Reason
                </TableHead>
                <TableHead scope="col" className="pr-4">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 font-medium">
                    <EmployeeRefName employee={r.employee} />
                  </TableCell>
                  <TableCell>
                    <LeaveTypeText request={r} />
                  </TableCell>
                  <TableCell>
                    <CalendarDateRange start={r.startDate} end={r.endDate} />
                  </TableCell>
                  <TableCell className="hidden max-w-xs whitespace-normal md:table-cell">
                    {r.reason ?? "—"}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex flex-col items-start gap-1">
                      <LeaveStatusBadge status={r.status} />
                      {r.decidedAt && (
                        <span className="text-xs text-muted-foreground">
                          <LocalTime value={r.decidedAt} dateOnly />
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
