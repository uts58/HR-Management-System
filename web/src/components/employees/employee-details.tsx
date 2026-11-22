import type { EmployeeDetail } from "@/contracts";
import { CalendarDate } from "@/components/calendar-date";
import { DescriptionList } from "@/components/common/description-list";
import {
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
} from "@/components/common/labels";
import { LocalTime } from "@/components/local-time";

const PLACEHOLDER_DOMAIN = "@users.invalid";

/**
 * Email cell: show the contact email (`employee.email`)
 * whenever there is one, even if the login account only has the placeholder
 * address (`emailIsPlaceholder`). "No email on file" only when there is no
 * contact email. A `@users.invalid` address is never displayed.
 */
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

/**
 * Read-only employee record, shared by HR's /employees/[id] and everyone's
 * /profile.
 */
export function EmployeeDetails({ employee }: { employee: EmployeeDetail }) {
  return (
    <DescriptionList
      items={[
        { label: "Full name", value: employee.fullName },
        { label: "Employee ID", value: String(employee.id) },
        { label: "Username", value: employee.username },
        { label: "Department", value: employee.department?.label },
        { label: "Position", value: employee.position?.label },
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
