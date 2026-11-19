"use client";

import { CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  startTransition,
  type ReactNode,
} from "react";
import { cn } from "cn";

import type { ActionResult, FieldErrors } from "@/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { FormAction } from "./types";

interface FormContextValue {
  fieldErrors: FieldErrors;
  pending: boolean;
}

const FormContext = createContext<FormContextValue>({
  fieldErrors: {},
  pending: false,
});

/** Field errors for one input, from the last action result. */
export function useFieldErrors(name: string): string[] | undefined {
  return useContext(FormContext).fieldErrors[name];
}

export function useFormPending(): boolean {
  return useContext(FormContext).pending;
}

interface ActionFormProps<T> {
  action: FormAction<T>;
  children: ReactNode;
  /** Accessible name for the form (e.g. "Add department"). */
  "aria-label"?: string;
  /** Message shown after a successful submit. Omit when onSuccess takes over. */
  successMessage?: string;
  /** Runs after a successful submit (e.g. show credentials, close a dialog). */
  onSuccess?: (data: T) => void;
  /** Clear the inputs after success (create forms next to a list). */
  resetOnSuccess?: boolean;
  /** Title of the form-level error alert. */
  errorTitle?: string;
  className?: string;
}

/**
 * Form wrapper for every mutation form (ADR-0006 rule 4):
 * - submits through `useActionState`, without React's automatic form reset,
 *   so values survive a failed submit;
 * - exposes `fieldErrors` to <FormField> via context, so errors render next
 *   to their inputs with aria-invalid / aria-describedby;
 * - shows `error.message` in a form-level alert;
 * - moves focus to the first invalid field, else to the alert, and to the
 *   success message after success (WCAG 3.3.1, 4.1.3).
 */
export function ActionForm<T>({
  action,
  children,
  successMessage,
  onSuccess,
  resetOnSuccess = false,
  errorTitle = "Could not save",
  className,
  ...rest
}: ActionFormProps<T>) {
  const [state, dispatch, pending] = useActionState<
    ActionResult<T> | null,
    FormData
  >(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccessRef.current?.(state.data);
      statusRef.current?.focus();
      return;
    }
    const firstInvalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    (firstInvalid ?? alertRef.current)?.focus();
  }, [state, resetOnSuccess]);

  const fieldErrors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {};

  return (
    <FormContext.Provider value={{ fieldErrors, pending }}>
      <form
        ref={formRef}
        aria-label={rest["aria-label"]}
        aria-busy={pending || undefined}
        className={cn("flex flex-col gap-5", className)}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          // TODO(Backend schemas): run the Zod schema from
          // @/lib/validation/<domain> here for instant feedback, then set
          // noValidate on the form so all errors render inline.
          startTransition(() => dispatch(formData));
        }}
      >
        {state && !state.ok && (
          <Alert variant="destructive" ref={alertRef} tabIndex={-1}>
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{errorTitle}</AlertTitle>
            <AlertDescription>{state.error.message}</AlertDescription>
          </Alert>
        )}
        {state?.ok && successMessage && (
          <div
            ref={statusRef}
            tabIndex={-1}
            role="status"
            className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CheckCircle2Icon className="size-4 shrink-0" aria-hidden="true" />
            {successMessage}
          </div>
        )}
        {children}
      </form>
    </FormContext.Provider>
  );
}

/** Submit button that shows the pending state of its <ActionForm>. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className,
  variant,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const pending = useFormPending();
  return (
    <Button
      type="submit"
      size="lg"
      variant={variant}
      disabled={pending}
      className={cn("min-w-28", className)}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
