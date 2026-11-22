"use client";

import { CircleAlertIcon } from "lucide-react";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { cn } from "cn";
import { toast } from "sonner";
import { z } from "zod";

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

export function useFieldErrors(name: string): string[] | undefined {
  return useContext(FormContext).fieldErrors[name];
}

export function useFormPending(): boolean {
  return useContext(FormContext).pending;
}

function formDataToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key);
    out[key] = values.length === 1 ? values[0] : values;
  }
  return out;
}

interface ActionFormProps<T> {
  action: FormAction<T>;
  schema?: z.ZodType;
  children: ReactNode;
  "aria-label"?: string;
  successMessage?: string;
  onSuccess?: (data: T) => void;
  resetOnSuccess?: boolean;
  errorTitle?: string;
  className?: string;
}

export function ActionForm<T>({
  action,
  schema,
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
  const onSuccessRef = useRef(onSuccess);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const [clientErrorTick, setClientErrorTick] = useState(0);

  const successMessageRef = useRef(successMessage);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    successMessageRef.current = successMessage;
  });

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccessRef.current?.(state.data);
      if (successMessageRef.current) toast.success(successMessageRef.current);
      return;
    }
    const firstInvalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    (firstInvalid ?? alertRef.current)?.focus();
  }, [state, resetOnSuccess]);

  useEffect(() => {
    if (clientErrorTick === 0) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [clientErrorTick]);

  const serverError = state && !state.ok && !clientErrors ? state.error : null;
  const fieldErrors = clientErrors ?? serverError?.fieldErrors ?? {};

  return (
    <FormContext.Provider value={{ fieldErrors, pending }}>
      <form
        ref={formRef}
        aria-label={rest["aria-label"]}
        aria-busy={pending || undefined}
        noValidate={schema ? true : undefined}
        className={cn("flex flex-col gap-5", className)}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          if (schema) {
            const parsed = schema.safeParse(formDataToObject(formData));
            if (!parsed.success) {
              setClientErrors(
                z.flattenError(parsed.error).fieldErrors as FieldErrors,
              );
              setClientErrorTick((tick) => tick + 1);
              return;
            }
          }
          setClientErrors(null);
          startTransition(() => dispatch(formData));
        }}
      >
        {serverError && (
          <Alert variant="destructive" ref={alertRef} tabIndex={-1}>
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{errorTitle}</AlertTitle>
            <AlertDescription>{serverError.message}</AlertDescription>
          </Alert>
        )}
        {children}
      </form>
    </FormContext.Provider>
  );
}

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
