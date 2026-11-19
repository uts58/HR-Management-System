import { CalendarPlusIcon, HistoryIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CalendarDateRange } from "@/components/calendar-date";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import {
  LeaveStatusBadge,
  StatusPill,
} from "@/components/common/status-badges";
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

import { listMyLeaveRequestsStub } from "../../../_stubs/services";
import { MarkLeaveDecisionsSeen } from "../_components/leave-client";
import { LeaveTypeText } from "../_components/leave-type-text";

export const metadata: Metadata = { title: "Leave history" };

/** Feature map row 26 (legacy /viewLeave). EMPLOYEE only. */
export default async function LeaveHistoryPage() {
  // TODO(Security): await requireRole(Role.EMPLOYEE, { onFail: "redirect" });
  // TODO(Backend): leaveService.listMyLeaveRequests(actor)
  const requests = await listMyLeaveRequestsStub();
  const unseen = requests.filter(
    (r) => r.status !== "PENDING" && !r.seenByEmployee,
  ).length;

  return (
    <>
      <MarkLeaveDecisionsSeen unseen={unseen} />
      <PageHeader
        title="My leave history"
        description="All your leave requests, newest first."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave history" },
        ]}
        actions={
          <Button render={<Link href="/leave/apply" />}>
            <CalendarPlusIcon aria-hidden="true" />
            Apply for leave
          </Button>
        }
      />
      {requests.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No leave requests found"
          description="Requests you submit will appear here with their status."
        />
      ) : (
        <Card className="py-0">
          <Table>
            <caption className="sr-only">
              My leave requests, newest first
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-4">
                  Type
                </TableHead>
                <TableHead scope="col">Dates</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Reason
                </TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="hidden pr-4 lg:table-cell">
                  Submitted
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4">
                    <LeaveTypeText request={r} />
                  </TableCell>
                  <TableCell>
                    <CalendarDateRange start={r.startDate} end={r.endDate} />
                  </TableCell>
                  <TableCell className="hidden max-w-xs whitespace-normal md:table-cell">
                    {r.reason ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <span className="flex flex-wrap items-center gap-1">
                        <LeaveStatusBadge status={r.status} />
                        {r.status !== "PENDING" && !r.seenByEmployee && (
                          <StatusPill tone="info">New</StatusPill>
                        )}
                      </span>
                      {r.decidedAt && (
                        <span className="text-xs text-muted-foreground">
                          <LocalTime value={r.decidedAt} dateOnly />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden pr-4 lg:table-cell">
                    <LocalTime value={r.createdAt} />
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
