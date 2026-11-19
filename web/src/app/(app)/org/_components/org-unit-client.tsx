"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/form-field";
import { createDepartmentSchema, createPositionSchema } from "@/lib/validation";

import { stubCommand, stubFormAction } from "../../../_stubs/actions";
import type { OrgUnitKind } from "./org-unit-copy";
import { ORG_UNIT_COPY } from "./org-unit-copy";

// TODO(wire): import createDepartment / createPosition
// from @/server/actions.
const createActions = {
  department: stubFormAction("createDepartment"),
  position: stubFormAction("createPosition"),
};

/** "Add department/position" form (feature map rows 16, 19). */
export function OrgUnitForm({ kind }: { kind: OrgUnitKind }) {
  const copy = ORG_UNIT_COPY[kind];
  const router = useRouter();
  return (
    <ActionForm
      aria-label={copy.addLabel}
      action={createActions[kind]}
      schema={
        kind === "department" ? createDepartmentSchema : createPositionSchema
      }
      successMessage={`${copy.singular} added.`}
      resetOnSuccess
      onSuccess={() => router.refresh()}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <TextField
          name="name"
          label={copy.nameLabel}
          required
          maxLength={100}
          autoComplete="off"
          className="sm:max-w-sm"
          description="Must be unique (case-insensitive)."
        />
        <SubmitButton pendingLabel="Adding…" className="sm:mt-6">
          {copy.addLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * Delete with confirmation (feature map rows 17, 20). The list renders an
 * "In use" note instead of this button while any employee (terminated ones
 * included) references the row; the server enforces the same rule with
 * CONFLICT, which shows inside the dialog.
 */
export function DeleteOrgUnitButton({
  kind,
  id,
  name,
}: {
  kind: OrgUnitKind;
  id: number;
  name: string;
}) {
  const copy = ORG_UNIT_COPY[kind];
  const router = useRouter();
  return (
    <ConfirmActionDialog
      triggerLabel="Delete"
      triggerAriaLabel={`Delete ${name}`}
      triggerIcon={<Trash2Icon aria-hidden="true" />}
      triggerVariant="ghost"
      title={`Delete ${copy.singular.toLowerCase()} "${name}"?`}
      description={`It will no longer be offered when adding or editing employees.`}
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      destructive
      successMessage={`${copy.singular} deleted.`}
      onConfirm={() => {
        void id;
        return stubCommand(
          kind === "department" ? "deleteDepartment" : "deletePosition",
        );
      }}
      onSuccess={() => router.refresh()}
    />
  );
}
