"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import { NOTICE_TYPES, type Notice } from "@/contracts";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { NOTICE_TYPE_LABELS } from "@/components/common/labels";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import {
  SelectField,
  TextareaField,
  TextField,
} from "@/components/forms/form-field";
import { createNoticeSchema } from "@/lib/validation";

import { stubCommand, stubFormAction } from "../../_stubs/actions";

// TODO(Frontend+Backend): createNotice from ./actions.ts.
const createNoticeAction = stubFormAction<Notice>("createNotice");

/** Post a notice (feature map row 22). Fields = CreateNoticeInput. */
export function NoticeForm() {
  const router = useRouter();
  return (
    <ActionForm
      aria-label="Post a notice"
      action={createNoticeAction}
      schema={createNoticeSchema}
      successMessage="Notice posted."
      resetOnSuccess
      onSuccess={() => router.refresh()}
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
        <TextField name="title" label="Title" required maxLength={200} />
        <SelectField
          name="type"
          label="Type"
          required
          defaultValue="GENERAL"
          options={NOTICE_TYPES.map((t) => ({
            value: t,
            label: NOTICE_TYPE_LABELS[t],
          }))}
          description="Urgent notices are highlighted."
        />
      </div>
      <TextareaField
        name="body"
        label="Notice"
        required
        maxLength={5000}
        rows={5}
        description="Up to 5000 characters."
      />
      <div>
        <SubmitButton pendingLabel="Posting…">Post notice</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Delete a notice with confirmation (feature map row 23). */
export function DeleteNoticeButton({
  id,
  title,
}: {
  id: number;
  title: string;
}) {
  const router = useRouter();
  return (
    <ConfirmActionDialog
      triggerLabel="Delete"
      triggerAriaLabel={`Delete notice "${title}"`}
      triggerIcon={<Trash2Icon aria-hidden="true" />}
      triggerVariant="ghost"
      title="Delete this notice?"
      description={`"${title}" will be removed from every dashboard. This cannot be undone.`}
      confirmLabel="Delete notice"
      pendingLabel="Deleting…"
      destructive
      onConfirm={() => {
        void id;
        // TODO(Frontend+Backend): deleteNotice from ./actions.ts.
        return stubCommand("deleteNotice");
      }}
      onSuccess={() => router.refresh()}
    />
  );
}
