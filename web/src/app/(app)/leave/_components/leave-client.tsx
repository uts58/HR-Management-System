"use client";

import { CheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  LEAVE_TYPE_LABELS,
  REQUESTABLE_LEAVE_TYPES,
  type LeaveDecision,
  type LeaveRequest,
} from "@/contracts";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import {
  SelectField,
  TextareaField,
  TextField,
} from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { applyForLeaveSchema } from "@/lib/validation";

import { stubCommand, stubFormAction } from "../../../_stubs/actions";

// TODO(wire): import applyForLeave from @/server/actions.
const applyForLeaveAction = stubFormAction<LeaveRequest>("applyForLeave");

/**
 * Leave request form (feature map rows 24–25). Fields = ApplyForLeaveInput.
 * Types come from REQUESTABLE_LEAVE_TYPES (no OTHER). Past dates are allowed.
 */
export function ApplyLeaveForm() {
  const router = useRouter();
  return (
    <ActionForm
      aria-label="Apply for leave"
      action={applyForLeaveAction}
      schema={applyForLeaveSchema}
      successMessage="Leave request submitted. HR will review it."
      resetOnSuccess
      onSuccess={() => router.refresh()}
    >
      <SelectField
        name="leaveType"
        label="Leave type"
        required
        defaultValue="SICK"
        className="sm:max-w-xs"
        options={REQUESTABLE_LEAVE_TYPES.map((t) => ({
          value: t,
          label: LEAVE_TYPE_LABELS[t],
        }))}
      />
      <div className="grid gap-5 sm:max-w-lg sm:grid-cols-2">
        <TextField name="startDate" label="From" type="date" required />
        <TextField
          name="endDate"
          label="To"
          type="date"
          required
          description="Inclusive. Must be on or after the start date."
        />
      </div>
      <TextareaField
        name="reason"
        label="Reason"
        maxLength={1000}
        rows={4}
        description="Up to 1000 characters."
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Submitting…">Submit request</SubmitButton>
        <Button
          variant="outline"
          size="lg"
          render={<Link href="/leave/history" />}
        >
          View my leave history
        </Button>
      </div>
    </ActionForm>
  );
}

/** Approve / Reject with confirmation (feature map row 28). */
export function DecideLeaveButtons({
  id,
  employeeName,
}: {
  id: number;
  employeeName: string;
}) {
  const router = useRouter();
  const decide = (decision: LeaveDecision) => {
    void id;
    void decision;
    // TODO(wire): import decideLeave(id, decision) from @/server/actions.
    return stubCommand("decideLeave");
  };
  return (
    <div className="flex justify-end gap-1.5">
      <ConfirmActionDialog
        triggerLabel="Approve"
        triggerAriaLabel={`Approve leave for ${employeeName}`}
        triggerIcon={<CheckIcon aria-hidden="true" />}
        title="Approve this leave?"
        description={`${employeeName} will see the decision on their dashboard. A decision can't be changed afterwards.`}
        confirmLabel="Approve"
        pendingLabel="Approving…"
        successMessage="Leave approved."
        onConfirm={() => decide("APPROVED")}
        onSuccess={() => router.refresh()}
      />
      <ConfirmActionDialog
        triggerLabel="Reject"
        triggerAriaLabel={`Reject leave for ${employeeName}`}
        triggerIcon={<XIcon aria-hidden="true" />}
        triggerVariant="destructive"
        title="Reject this leave?"
        description={`${employeeName} will see the decision on their dashboard. A decision can't be changed afterwards.`}
        confirmLabel="Reject"
        pendingLabel="Rejecting…"
        destructive
        successMessage="Leave rejected."
        onConfirm={() => decide("REJECTED")}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

/**
 * Marks the employee's decided requests as seen once, AFTER the history
 * page has rendered (feature map row 26). Reads stay side-effect free, so
 * link prefetching can't clear the dashboard notification.
 */
export function MarkLeaveDecisionsSeen({ unseen }: { unseen: number }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || unseen === 0) return;
    done.current = true;
    // TODO(wire): import markLeaveDecisionsSeen from @/server/actions
    // (leaveService.markMyLeaveDecisionsSeen).
    void stubCommand("markLeaveDecisionsSeen");
  }, [unseen]);
  return null;
}
