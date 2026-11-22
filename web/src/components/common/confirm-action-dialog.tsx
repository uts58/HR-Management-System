"use client";

import { CircleAlertIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * Confirmation step for destructive or irreversible actions (ADR-0004
 * rule 9, ADR-0009 rule 7). Focus moves into the dialog, Escape cancels,
 * and focus returns to the trigger on close. A failed action keeps the
 * dialog open and shows the error message inside it.
 */
export function ConfirmActionDialog<T>({
  triggerLabel,
  triggerIcon,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerAriaLabel,
  title,
  description,
  confirmLabel,
  pendingLabel = "Working…",
  destructive = false,
  onConfirm,
  onSuccess,
  successMessage,
}: {
  triggerLabel: string;
  triggerIcon?: ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  /** Fuller name for screen readers when the visible label is short (e.g. "Delete Finance"). */
  triggerAriaLabel?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult<T>>;
  onSuccess?: (data: T) => void;
  /** Success toast (ADR-0006 rule 4), e.g. "Department deleted." */
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            aria-label={triggerAriaLabel}
          />
        }
      >
        {triggerIcon}
        {triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await onConfirm();
                if (result.ok) {
                  setOpen(false);
                  setError(null);
                  onSuccess?.(result.data);
                  if (successMessage)
                    toast.success(successMessage, { id: successMessage });
                } else {
                  setError(result.error.message);
                }
              })
            }
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
