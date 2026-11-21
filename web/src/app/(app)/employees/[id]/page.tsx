import { PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Role, requireRole } from "@/auth";
import { toActor } from "@/server/action";

import { PageHeader } from "@/components/common/page-header";
import { EmploymentStatusBadge } from "@/components/common/status-badges";
import { EmployeeDetails } from "@/components/employees/employee-details";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { employeeService } from "@/server/employee/service";
import { idOrNotFound, orNotFound } from "@/server/page";

import {
  ResetPasswordButton,
  TerminateEmployeeButton,
} from "../_components/employee-actions";

export const metadata: Metadata = { title: "Employee details" };

/** Feature map rows 10, 13 and reset password (legacy /hr/viewDetails). HR only. */
export default async function EmployeeDetailPage({
  params,
}: PageProps<"/employees/[id]">) {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const id = idOrNotFound((await params).id);
  const employee = await orNotFound(employeeService.getEmployee(actor, id));

  const name = `${employee.firstName} ${employee.lastName}`;
  const active = employee.status === "ACTIVE";

  return (
    <>
      <PageHeader
        title={name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <EmploymentStatusBadge status={employee.status} />
            {employee.position?.label}
            {employee.department ? ` · ${employee.department.label}` : null}
          </span>
        }
        breadcrumbs={[
          { label: "Employees", href: "/employees" },
          { label: name },
        ]}
        actions={
          active ? (
            <Button render={<Link href={`/employees/${employee.id}/edit`} />}>
              <PencilIcon aria-hidden="true" />
              Edit
            </Button>
          ) : undefined
        }
      />

      {!active && (
        <p className="mb-6 rounded-lg border bg-muted px-4 py-3 text-sm">
          Terminated on <LocalTime value={employee.terminatedAt} />. Their
          record and history are kept; it can no longer be edited and the login
          is disabled.
        </p>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <CardContent>
            <EmployeeDetails employee={employee} />
          </CardContent>
        </Card>

        {active && (
          <section
            aria-labelledby="account-actions"
            className="flex flex-col gap-3 rounded-xl border p-4"
          >
            <h2 id="account-actions" className="font-heading font-semibold">
              Account actions
            </h2>
            <div className="flex flex-wrap items-start gap-2">
              {employee.username && (
                <ResetPasswordButton employeeId={employee.id} name={name} />
              )}
              {employee.id !== session.user.employeeId && (
                <TerminateEmployeeButton employeeId={employee.id} name={name} />
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
