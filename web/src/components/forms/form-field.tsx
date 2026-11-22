"use client";

import { useId, type ReactNode } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { useFieldErrors } from "./action-form";

export interface ControlProps {
  id: string;
  name: string;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  description?: ReactNode;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

export function FormField({
  name,
  label,
  required = false,
  description,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const errors = useFieldErrors(name);
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <Field
      data-invalid={errors?.length ? true : undefined}
      className={className}
    >
      <FieldLabel htmlFor={id}>
        {label}
        {!required && (
          <span className="font-normal text-muted-foreground">(optional)</span>
        )}
      </FieldLabel>
      {children({
        id,
        name,
        required: required || undefined,
        "aria-invalid": errors?.length ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {errors?.length ? (
        <FieldError id={errorId}>
          {errors.length === 1 ? (
            errors[0]
          ) : (
            <ul className="ml-4 list-disc">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </FieldError>
      ) : null}
    </Field>
  );
}

type InputProps = Omit<React.ComponentProps<typeof Input>, "name" | "id">;

export function TextField({
  name,
  label,
  required,
  description,
  className,
  ...inputProps
}: Omit<FormFieldProps, "children"> & InputProps) {
  return (
    <FormField
      name={name}
      label={label}
      required={required}
      description={description}
      className={className}
    >
      {(control) => <Input {...inputProps} {...control} />}
    </FormField>
  );
}

export function TextareaField({
  name,
  label,
  required,
  description,
  className,
  ...textareaProps
}: Omit<FormFieldProps, "children"> &
  Omit<React.ComponentProps<typeof Textarea>, "name" | "id">) {
  return (
    <FormField
      name={name}
      label={label}
      required={required}
      description={description}
      className={className}
    >
      {(control) => <Textarea {...textareaProps} {...control} />}
    </FormField>
  );
}

export interface SelectOption {
  value: string | number;
  label: string;
}

export function SelectField({
  name,
  label,
  required,
  description,
  className,
  options,
  placeholder,
  defaultValue,
}: Omit<FormFieldProps, "children"> & {
  options: readonly SelectOption[];
  placeholder?: string;
  defaultValue?: string | number;
}) {
  return (
    <FormField
      name={name}
      label={label}
      required={required}
      description={description}
      className={className}
    >
      {(control) => (
        <NativeSelect
          {...control}
          defaultValue={defaultValue ?? (placeholder ? "" : undefined)}
          className="w-full"
        >
          {placeholder && (
            <NativeSelectOption value="" disabled={required}>
              {placeholder}
            </NativeSelectOption>
          )}
          {options.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
}

export function RadioGroupField({
  name,
  label,
  required,
  options,
  defaultValue,
  className,
}: {
  name: string;
  label: string;
  required?: boolean;
  options: readonly SelectOption[];
  defaultValue?: string;
  className?: string;
}) {
  const id = useId();
  const errors = useFieldErrors(name);
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <FieldSet
      className={className}
      aria-describedby={errorId}
      data-invalid={errors?.length ? true : undefined}
    >
      <FieldLegend variant="label">{label}</FieldLegend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {options.map((o, index) => {
          const optionId = `${id}-${index}`;
          return (
            <div key={o.value} className="flex items-center gap-2">
              <input
                type="radio"
                id={optionId}
                name={name}
                value={o.value}
                required={required}
                defaultChecked={defaultValue === String(o.value)}
                className="size-4 accent-primary"
              />
              <label htmlFor={optionId} className="text-sm">
                {o.label}
              </label>
            </div>
          );
        })}
      </div>
      {errors?.length ? (
        <FieldError id={errorId}>{errors.join(" ")}</FieldError>
      ) : null}
    </FieldSet>
  );
}
