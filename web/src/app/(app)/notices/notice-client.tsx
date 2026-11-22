"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import { NOTICE_TYPES } from "@/contracts";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { NOTICE_TYPE_LABELS } from "@/components/common/labels";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import {
  SelectField,
  TextareaField,
  TextField,
} from "@/components/forms/form-field";
import { createNoticeSchema } from "@/lib/validation";
import { createNotice, deleteNotice } from "@/server/actions/notice";

export function NoticeForm() {
  const router = useRouter();
  return (
    <ActionForm
      aria-label="Post a notice"
      action={createNotice}
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
      successMessage="Notice deleted."
      onConfirm={() => deleteNotice({ id })}
      onSuccess={() => router.refresh()}
    />
  );
}
