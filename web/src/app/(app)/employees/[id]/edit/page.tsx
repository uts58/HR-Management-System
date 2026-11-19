import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/common/page-header";
import { NotFoundState } from "@/components/common/not-found-state";
import { Card, CardContent } from "@/components/ui/card";

import {
  getEmployeeFormOptionsStub,
  getEmployeeStub,
} from "../../../../_stubs/services";
import { EmployeeForm } from "../../_components/employee-form";
import { parseId } from "../../_components/parse-id";

export const metadata: Metadata = { title: "Edit employee" };

/** Feature map rows 11–12 (legacy /hr/editEmployee, /hr/editEmp). HR only. */
export default async function EditEmployeePage({
  params,
}: PageProps<"/employees/[id]/edit">) {
  // TODO(Security): await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const id = parseId((await params).id);
  if (id === null) notFound();
  // TODO(Backend): employeeService.getEmployee(actor, id) and
  // employeeService.getEmployeeFormOptions(actor); NOT_FOUND → notFound()
  const [employee, options] = await Promise.all([
    getEmployeeStub(id),
    getEmployeeFormOptionsStub(),
  ]);
  if (!employee) notFound();

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
