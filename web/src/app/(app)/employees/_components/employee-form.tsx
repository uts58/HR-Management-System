"use client";

import Link from "next/link";
import { useState } from "react";

import {
  USERNAME_PATTERN,
  type CreateEmployeeResult,
  type EmployeeDetail,
  type EmployeeFormOptions,
} from "@/contracts";
import { CredentialsPanel } from "@/components/common/credentials-panel";
import {
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
} from "@/components/common/labels";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import {
  RadioGroupField,
  SelectField,
  TextField,
} from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import {
  createEmployeeSchema,
  updateEmployeeActionSchema,
} from "@/lib/validation";
import { createEmployee, updateEmployee } from "@/server/actions/employee";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";

/**
 * Add / edit employee (feature map rows 8–9, 11–12). Field names equal the
 * contract property names (CreateEmployeeInput / UpdateEmployeeInput).
 * HTML constraints mirror contracts.md; the authoritative checks are
 * Backend's Zod schemas on the server.
 */
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
          Employee {created.employee.firstName} {created.employee.lastName} was
          added.
        </p>
        <CredentialsPanel credentials={created.credentials} />
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href={`/employees/${created.employee.id}`} />}>
            View employee
          </Button>
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
        <FieldLegend>Personal details</FieldLegend>
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
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="dateOfBirth"
            label="Date of birth"
            type="date"
            required
            description="Must be before today."
            defaultValue={v?.dateOfBirth ?? undefined}
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
        <RadioGroupField
          name="gender"
          label="Gender"
          required
          defaultValue={v?.gender ?? undefined}
          options={options.genders.map((g) => ({
            value: g,
            label: GENDER_LABELS[g],
          }))}
        />
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
      </FieldSet>

      <Separator />

      <FieldSet>
        <FieldLegend>Contact and address</FieldLegend>
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
        <Button
          variant="outline"
          size="lg"
          render={<Link href={v ? `/employees/${v.id}` : "/employees"} />}
        >
          Cancel
        </Button>
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
