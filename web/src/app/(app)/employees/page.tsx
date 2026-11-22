import { UserPlusIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";

import { Role, requireRole } from "@/auth";
import { toActor } from "@/server/action";
import type { EmployeeStatusFilter } from "@/contracts";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import {
  EmploymentStatusBadge,
  RoleBadge,
} from "@/components/common/status-badges";
import { LocalTime } from "@/components/local-time";
import { listEmployeesFilterSchema } from "@/lib/validation";
import { employeeService } from "@/server/employee/service";
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

import { TerminateEmployeeButton } from "./_components/employee-actions";

export const metadata: Metadata = { title: "Employees" };

const FILTERS: { value: EmployeeStatusFilter; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "ALL", label: "All" },
];

export default async function EmployeesPage({
  searchParams,
}: PageProps<"/employees">) {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const { status } = listEmployeesFilterSchema.parse({
    status: (await searchParams).status,
  });
  const employees = await employeeService.listEmployees(actor, { status });

  return (
    <>
      <PageHeader
        title="Employees"
        description="Everyone with an employee record. Terminated employees are hidden unless you ask for them."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Employees" },
        ]}
        actions={
          <Button render={<Link href="/employees/new" />}>
            <UserPlusIcon aria-hidden="true" />
            Add employee
          </Button>
        }
      />

      <nav aria-label="Filter by status" className="mb-4">
        <ul className="inline-flex rounded-lg border bg-muted p-0.5">
          {FILTERS.map((f) => (
            <li key={f.value}>
              <Link
                href={
                  f.value === "ACTIVE"
                    ? "/employees"
                    : `/employees?status=${f.value}`
                }
                aria-current={status === f.value ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  status === f.value &&
                    "bg-background text-foreground shadow-sm",
                )}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {employees.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No employees to show"
          description={
            status === "TERMINATED"
              ? "No one has been terminated."
              : "Add your first employee to get started."
          }
        />
      ) : (
        <Card className="py-0">
          <Table>
            <caption className="sr-only">
              Employees ({FILTERS.find((f) => f.value === status)?.label}),{" "}
              {employees.length} rows
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-16 pl-4">
                  ID
                </TableHead>
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Position
                </TableHead>
                <TableHead scope="col" className="hidden lg:table-cell">
                  Department
                </TableHead>
                <TableHead scope="col" className="hidden lg:table-cell">
                  Email
                </TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="pl-4 text-muted-foreground tabular-nums">
                    {e.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/employees/${e.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {e.fullName}
                      </Link>
                      <div className="flex flex-wrap gap-1">
                        <RoleBadge role={e.role} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {e.positionName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {e.departmentName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-56 truncate lg:table-cell">
                    {e.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <EmploymentStatusBadge status={e.status} />
                      {e.terminatedAt && (
                        <span className="text-xs text-muted-foreground">
                          <LocalTime value={e.terminatedAt} dateOnly />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1.5">
                      {e.status === "ACTIVE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={`/employees/${e.id}/edit`} />}
                          aria-label={`Edit ${e.fullName}`}
                        >
                          Edit
                        </Button>
                      )}
                      {e.status === "ACTIVE" &&
                        e.id !== session.user.employeeId && (
                          <TerminateEmployeeButton
                            employeeId={e.id}
                            name={e.fullName}
                            compact
                          />
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
