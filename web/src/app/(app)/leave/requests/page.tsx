import { CalendarCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CalendarDateRange } from "@/components/calendar-date";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeRefName } from "@/components/common/status-badges";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
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
import { DecideLeaveButtons } from "../_components/leave-client";
import { LeaveTypeText } from "../_components/leave-type-text";

export const metadata: Metadata = { title: "Pending leave requests" };

export default async function PendingLeavePage() {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const requests = await leaveService.listPendingLeaveRequests(actor);

  return (
    <>
      <PageHeader
        title="Pending leave requests"
        description="Oldest first. Each request can be decided once."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Pending leave requests" },
        ]}
        actions={
          <Button variant="outline" render={<Link href="/leave/all" />}>
            View all leave
          </Button>
        }
      />
      {requests.length === 0 ? (
        <EmptyState
          icon={CalendarCheckIcon}
          title="No pending leave requests"
          description="You're all caught up."
        />
      ) : (
        <Card className="py-0">
          <Table>
            <caption className="sr-only">
              Pending leave requests, oldest first
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
                <TableHead scope="col" className="hidden lg:table-cell">
                  Submitted
                </TableHead>
                <TableHead scope="col" className="pr-4 text-right">
                  <span className="sr-only">Decision</span>
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
                  <TableCell className="hidden lg:table-cell">
                    <LocalTime value={r.createdAt} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <DecideLeaveButtons
                      id={r.id}
                      employeeName={r.employee.name}
                    />
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
