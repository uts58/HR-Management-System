"use client";

import { useState } from "react";

import {
  DEFAULT_EMPLOYMENT_TYPE,
  EMPLOYEE_NUMBER_MAX,
  USERNAME_PATTERN,
  type CreateEmployeeResult,
  type EmployeeDetail,
  type EmployeeFormOptions,
} from "@/contracts";
import { CredentialsPanel } from "@/components/common/credentials-panel";
import {
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
} from "@/components/common/labels";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/form-field";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  createEmployeeSchema,
  MAX_INPUT_DATE,
  MIN_INPUT_DATE,
  updateEmployeeActionSchema,
} from "@/lib/validation";
import { createEmployee, updateEmployee } from "@/server/actions/employee";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";

export function EmployeeForm({
  mode,
  options,
  employee,
}: {
  mode: "create" | "edit";
  options: EmployeeFormOptions;
  employee?: EmployeeDetail;
}) {
  const [created, setCreated] = useState<CreateEmployeeResult | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (created) {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="text-sm font-medium text-success">
          Employee {created.employee.fullName} was added.
        </p>
        <CredentialsPanel credentials={created.credentials} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/employees/${created.employee.id}`}>
            View employee
          </ButtonLink>
          <Button
            variant="outline"
            onClick={() => {
              setCreated(null);
              setFormKey((k) => k + 1);
            }}
          >
            Add another employee
          </Button>
        </div>
      </div>
    );
  }

  const v = employee;
  const fields = (
    <>
      <p className="text-sm text-muted-foreground">
        All fields are required unless marked optional.
      </p>

      <FieldSet>
        <FieldLegend>Personal</FieldLegend>
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            name="firstName"
            label="First name"
            required
            maxLength={100}
            autoComplete="off"
            defaultValue={v?.firstName}
          />
          <TextField
            name="middleName"
            label="Middle name"
            maxLength={100}
            autoComplete="off"
            defaultValue={v?.middleName ?? undefined}
          />
          <TextField
            name="lastName"
            label="Last name"
            required
            maxLength={100}
            autoComplete="off"
            defaultValue={v?.lastName}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            name="dateOfBirth"
            label="Date of birth"
            type="date"
            required
            description="Must be before today."
            defaultValue={v?.dateOfBirth ?? undefined}
          />
          <SelectField
            name="gender"
            label="Gender"
            placeholder="Not specified"
            defaultValue={v?.gender ?? undefined}
            options={options.genders.map((g) => ({
              value: g,
              label: GENDER_LABELS[g],
            }))}
          />
          <SelectField
            name="maritalStatus"
            label="Marital status"
            required
            placeholder="Select marital status"
            defaultValue={v?.maritalStatus ?? undefined}
            options={options.maritalStatuses.map((s) => ({
              value: s,
              label: MARITAL_STATUS_LABELS[s],
            }))}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="email"
            label="Email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            defaultValue={v?.email ?? undefined}
          />
          <TextField
            name="contactNo"
            label="Contact number"
            type="tel"
            required
            minLength={5}
            maxLength={20}
            pattern="[0-9+()\- ]{5,20}"
            description="5–20 characters: digits, spaces and + - ( )."
            defaultValue={v?.contactNo ?? undefined}
          />
          <SelectField
            name="country"
            label="Country"
            required
            placeholder="Select country"
            defaultValue={v?.country ?? undefined}
            options={options.countries.map((c) => ({ value: c, label: c }))}
          />
          <TextField
            name="homeTown"
            label="Home town"
            required
            maxLength={100}
            defaultValue={v?.homeTown ?? undefined}
          />
        </div>
      </FieldSet>

      <Separator />

      <FieldSet>
        <FieldLegend>Job</FieldLegend>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="departmentId"
            label="Department"
            required
            placeholder="Select department"
            defaultValue={v?.department?.id}
            options={options.departments.map((d) => ({
              value: d.id,
              label: d.label,
            }))}
          />
          <SelectField
            name="positionId"
            label="Position"
            required
            placeholder="Select position"
            defaultValue={v?.position?.id}
            options={options.positions.map((p) => ({
              value: p.id,
              label: p.label,
            }))}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField
            name="employmentType"
            label="Employment type"
            required
            defaultValue={v?.employmentType ?? DEFAULT_EMPLOYMENT_TYPE}
            options={options.employmentTypes.map((t) => ({
              value: t,
              label: EMPLOYMENT_TYPE_LABELS[t],
            }))}
          />
          <TextField
            name="hireDate"
            label="Hire date"
            type="date"
            min={MIN_INPUT_DATE}
            max={MAX_INPUT_DATE}
            defaultValue={v?.hireDate ?? undefined}
          />
          <TextField
            name="employeeNumber"
            label="Employee number"
            maxLength={EMPLOYEE_NUMBER_MAX}
            autoComplete="off"
            spellCheck={false}
            description="Must be unique."
            defaultValue={v?.employeeNumber ?? undefined}
          />
        </div>
      </FieldSet>

      {mode === "create" && (
        <>
          <Separator />
          <FieldSet>
            <FieldLegend>Login</FieldLegend>
            <TextField
              name="username"
              label="Username"
              pattern={USERNAME_PATTERN.replace(/^\^|\$$/g, "")}
              minLength={3}
              maxLength={30}
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              className="sm:max-w-sm"
              description="3–30 lower-case letters, digits, dots or underscores. Leave blank to use first.last. A temporary password is generated and shown once after saving."
            />
          </FieldSet>
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-5">
        <SubmitButton>
          {mode === "create" ? "Add employee" : "Save changes"}
        </SubmitButton>
        <ButtonLink
          variant="outline"
          size="lg"
          href={v ? `/employees/${v.id}` : "/employees"}
        >
          Cancel
        </ButtonLink>
      </div>
    </>
  );

  return mode === "create" ? (
    <ActionForm
      key={formKey}
      aria-label="Add employee"
      action={createEmployee}
      schema={createEmployeeSchema}
      onSuccess={setCreated}
    >
      {fields}
    </ActionForm>
  ) : (
    <ActionForm
      aria-label="Edit employee"
      action={updateEmployee}
      schema={updateEmployeeActionSchema}
      successMessage="Employee details saved."
    >
      <input type="hidden" name="id" value={employee?.id ?? ""} />
      {fields}
    </ActionForm>
  );
}
