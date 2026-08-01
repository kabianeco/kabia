"use client";

import { useId } from "react";
import type {
  ComponentPropsWithoutRef,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Form controls in the editorial language of the rest of the site: hairline
 * bottom rules rather than boxed inputs, tracked uppercase labels, and the
 * shared brand focus ring from globals.css.
 */

const control =
  "w-full min-h-12 border-b border-ink/20 bg-transparent px-0 py-3 text-base text-ink " +
  "placeholder:text-ink/35 transition-colors duration-300 focus:border-brand focus:outline-none " +
  "disabled:opacity-55";

const controlInvalid = "border-clay focus:border-clay";

interface FieldShellProps {
  label: string;
  /** Extra guidance shown under the label; wired up via aria-describedby. */
  hint?: string;
  error?: string;
  className?: string;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
}

export function Field({ label, hint, error, className, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={id} className="label text-olive">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-ink/50">
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: !!error })}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs text-clay">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = Omit<ComponentPropsWithoutRef<"input">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
};

export function TextField({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  ...props
}: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, invalid && controlInvalid, className)}
          {...props}
        />
      )}
    </Field>
  );
}

type TextAreaProps = Omit<ComponentPropsWithoutRef<"textarea">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
};

export function TextAreaField({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  rows = 4,
  ...props
}: TextAreaProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, "resize-y", invalid && controlInvalid, className)}
          {...props}
        />
      )}
    </Field>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  children: ReactNode;
};

export function SelectField({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, "cursor-pointer", invalid && controlInvalid, className)}
          {...props}
        >
          {children}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "type"> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink/75",
        className,
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
        {...props}
      />
      {label}
    </label>
  );
}
