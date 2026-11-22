import type { Metadata } from "next";

import { Role, requireRole } from "@/auth";
import { toActor } from "@/server/action";

import { PageHeader } from "@/components/common/page-header";
import { NotFoundState } from "@/components/common/not-found-state";
import { Card, CardContent } from "@/components/ui/card";
import { employeeService } from "@/server/employee/service";
import { idOrNotFound, orNotFound } from "@/server/page";

import { EmployeeForm } from "../../_components/employee-form";

export const metadata: Metadata = { title: "Edit employee" };

/** HR only. */
export default async function EditEmployeePage({
  params,
}: PageProps<"/employees/[id]/edit">) {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const id = idOrNotFound((await params).id);
  const [employee, options] = await Promise.all([
    orNotFound(employeeService.getEmployee(actor, id)),
    employeeService.getEmployeeFormOptions(actor),
  ]);

  const name = `${employee.firstName} ${employee.lastName}`;

  if (employee.status === "TERMINATED") {
    return (
      <NotFoundState
        title="This employee can't be edited"
        description={`${name} has been terminated. Terminated records are kept read-only.`}
        backHref={`/employees/${employee.id}`}
        backLabel="Back to employee"
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`Edit ${name}`}
        description="Changing the name does not change the username."
        breadcrumbs={[
          { label: "Employees", href: "/employees" },
          { label: name, href: `/employees/${employee.id}` },
          { label: "Edit" },
        ]}
      />
      <Card>
        <CardContent>
          <EmployeeForm mode="edit" options={options} employee={employee} />
        </CardContent>
      </Card>
    </>
  );
}
