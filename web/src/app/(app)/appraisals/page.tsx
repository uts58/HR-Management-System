import { ClipboardListIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RATING_LABELS } from "@/contracts";
import { CalendarDateRange } from "@/components/calendar-date";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeRefName } from "@/components/common/status-badges";
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
import { performanceService } from "@/server/performance/service";
import { DeleteAppraisalButton } from "./appraisal-client";

export const metadata: Metadata = { title: "Appraisals" };

/** HR only. */
export default async function AppraisalsPage() {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const appraisals = await performanceService.listAppraisals(actor);

  return (
    <>
      <PageHeader
        title="Performance appraisals"
        description="Newest first. Employees can't see appraisals."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Appraisals" },
        ]}
        actions={
          <Button render={<Link href="/appraisals/new" />}>
            <ClipboardListIcon aria-hidden="true" />
            Add appraisal
          </Button>
        }
      />
      {appraisals.length === 0 ? (
        <EmptyState
          icon={StarIcon}
          title="No appraisals recorded yet"
          action={
            <Button render={<Link href="/appraisals/new" />}>
              Add appraisal
            </Button>
          }
        />
      ) : (
        <Card className="py-0">
          <Table>
            <caption className="sr-only">
              Performance appraisals, newest first
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-4">
                  Employee
                </TableHead>
                <TableHead scope="col">Project</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Period
                </TableHead>
                <TableHead scope="col">Rating</TableHead>
                <TableHead scope="col" className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appraisals.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-4 font-medium">
                    <EmployeeRefName employee={a.employee} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {a.projectName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <CalendarDateRange
                      start={a.projectStart}
                      end={a.projectEnd}
                    />
                  </TableCell>
                  <TableCell>
                    {a.rating ? (
                      <span>
                        <span className="font-medium tabular-nums">
                          {a.rating}/5
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {RATING_LABELS[a.rating]}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <DeleteAppraisalButton
                      id={a.id}
                      label={`${a.employee.name}, ${a.projectName ?? "untitled project"}`}
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
