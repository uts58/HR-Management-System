"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  RATINGS,
  RATING_LABELS,
  type EmployeeId,
  type Option,
} from "@/contracts";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/form-field";
import { ButtonLink } from "@/components/ui/button";
import { createAppraisalSchema } from "@/lib/validation";
import { createAppraisal, deleteAppraisal } from "@/server/actions/performance";

export function AppraisalForm({
  employees,
}: {
  employees: Option<EmployeeId>[];
}) {
  return (
    <ActionForm
      aria-label="Add appraisal"
      action={createAppraisal}
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
        <ButtonLink variant="outline" size="lg" href="/appraisals">
          Back to appraisals
        </ButtonLink>
      </div>
    </ActionForm>
  );
}

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
      onConfirm={() => deleteAppraisal({ id })}
      onSuccess={() => router.refresh()}
    />
  );
}
