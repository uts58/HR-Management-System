import type { EmployeeDetail } from "@/contracts";
import { CalendarDate } from "@/components/calendar-date";
import { DescriptionList } from "@/components/common/description-list";
import {
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
} from "@/components/common/labels";
import { LocalTime } from "@/components/local-time";

const PLACEHOLDER_DOMAIN = "@users.invalid";

function EmailValue({ employee }: { employee: EmployeeDetail }) {
  if (
    !employee.email ||
    employee.email.toLowerCase().endsWith(PLACEHOLDER_DOMAIN)
  ) {
    return <span className="text-muted-foreground">No email on file</span>;
  }
  return (
    <a
      href={`mailto:${employee.email}`}
      className="text-primary underline-offset-4 hover:underline"
    >
      {employee.email}
    </a>
  );
}

export function EmployeeDetails({ employee }: { employee: EmployeeDetail }) {
  return (
    <DescriptionList
      items={[
        { label: "Full name", value: employee.fullName },
        { label: "Employee ID", value: String(employee.id) },
        { label: "Username", value: employee.username },
        { label: "Employee number", value: employee.employeeNumber },
        { label: "Department", value: employee.department?.label },
        { label: "Position", value: employee.position?.label },
        {
          label: "Employment type",
          value: EMPLOYMENT_TYPE_LABELS[employee.employmentType],
        },
        {
          label: "Hire date",
          value: <CalendarDate value={employee.hireDate} />,
        },
        { label: "Email", value: <EmailValue employee={employee} /> },
        { label: "Contact number", value: employee.contactNo },
        { label: "Country", value: employee.country },
        { label: "Home town", value: employee.homeTown },
        {
          label: "Gender",
          value: employee.gender ? GENDER_LABELS[employee.gender] : null,
        },
        {
          label: "Marital status",
          value: employee.maritalStatus
            ? MARITAL_STATUS_LABELS[employee.maritalStatus]
            : null,
        },
        {
          label: "Date of birth",
          value: <CalendarDate value={employee.dateOfBirth} />,
        },
        {
          label: "Record created",
          value: <LocalTime value={employee.createdAt} />,
        },
      ]}
    />
  );
}
