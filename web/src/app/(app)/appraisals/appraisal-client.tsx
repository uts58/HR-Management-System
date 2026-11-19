"use client";

import { Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  RATINGS,
  RATING_LABELS,
  type Appraisal,
  type EmployeeId,
  type Option,
} from "@/contracts";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { createAppraisalSchema } from "@/lib/validation";

import { stubCommand, stubFormAction } from "../../_stubs/actions";

// TODO(wire): import createAppraisal from @/server/actions.
const createAppraisalAction = stubFormAction<Appraisal>("createAppraisal");

/** Add appraisal (feature map rows 30–31). Fields = CreateAppraisalInput. */
export function AppraisalForm({
  employees,
}: {
  employees: Option<EmployeeId>[];
}) {
  return (
    <ActionForm
      aria-label="Add appraisal"
      action={createAppraisalAction}
      schema={createAppraisalSchema}
      successMessage="Appraisal saved."
      resetOnSuccess
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="employeeId"
          label="Employee"
          required
          placeholder="Select employee"
          description="Active employees only."
          options={employees.map((e) => ({ value: e.id, label: e.label }))}
        />
        <TextField
          name="projectName"
          label="Project name"
          required
          maxLength={200}
        />
        <TextField
          name="projectStart"
          label="Start date"
          type="date"
          required
        />
        <TextField
          name="projectEnd"
          label="End date"
          type="date"
          required
          description="On or after the start date."
        />
        <SelectField
          name="rating"
          label="Rating"
          required
          defaultValue={3}
          options={RATINGS.map((r) => ({
            value: r,
            label: `${r} – ${RATING_LABELS[r]}`,
          }))}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton>Save appraisal</SubmitButton>
        <Button
          variant="outline"
          size="lg"
          render={<Link href="/appraisals" />}
        >
          Back to appraisals
        </Button>
      </div>
    </ActionForm>
  );
}

/** Delete with confirmation (feature map row 33). */
export function DeleteAppraisalButton({
  id,
  label,
}: {
  id: number;
  label: string;
}) {
  const router = useRouter();
  return (
    <ConfirmActionDialog
      triggerLabel="Delete"
      triggerAriaLabel={`Delete appraisal: ${label}`}
      triggerIcon={<Trash2Icon aria-hidden="true" />}
      triggerVariant="ghost"
      title="Delete this appraisal?"
      description={`${label}. This cannot be undone.`}
      confirmLabel="Delete appraisal"
      pendingLabel="Deleting…"
      destructive
      successMessage="Appraisal deleted."
      onConfirm={() => {
        void id;
        // TODO(wire): import deleteAppraisal({ id }) from @/server/actions.
        return stubCommand("deleteAppraisal");
      }}
      onSuccess={() => router.refresh()}
    />
  );
}
