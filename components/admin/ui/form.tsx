"use client"

import { useFormStatus } from "react-dom"
import { useId } from "react"
import type { ComponentPropsWithoutRef, ReactNode, SelectHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

/**
 * Administrative form controls.
 *
 * The storefront sets its inputs as hairline bottom rules — beautiful for an
 * editorial checkout, unreadable in a dense two-column product editor where a
 * field's extent has to be obvious at a glance. These are boxed instead, on the
 * same warm surface, with the same brand focus ring, the same tracked labels
 * and the same clay for errors. Same language, operational register.
 *
 * Every control wires up label, description and error via ids, so the error is
 * announced with the field rather than floating near it.
 */

const control =
  "w-full min-h-11 rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink/30 transition-colors duration-200 " +
  "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40 " +
  "disabled:cursor-not-allowed disabled:opacity-55"

const controlInvalid = "border-clay focus:border-clay focus:ring-clay/30"

interface BaseProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  wrapperClassName?: string
}

function useFieldIds(hint?: string, error?: string) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined
  return { id, hintId, errorId, describedBy, invalid: Boolean(error) }
}

function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  hintId,
  errorId,
  className,
  children,
}: BaseProps & {
  htmlFor: string
  hintId?: string
  errorId?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={htmlFor} className="label mb-1.5 text-olive">
        {label}
        {required && (
          <span className="ml-1 text-clay" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="mb-1.5 text-xs leading-relaxed text-ink/45">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-clay">
          {error}
        </p>
      )}
    </div>
  )
}

export function AdminInput({
  label,
  hint,
  error,
  required,
  wrapperClassName,
  className,
  ...props
}: BaseProps & Omit<ComponentPropsWithoutRef<"input">, "id">) {
  const { id, hintId, errorId, describedBy, invalid } = useFieldIds(hint, error)
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={id}
      hintId={hintId}
      errorId={errorId}
      className={wrapperClassName}
    >
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        required={required}
        className={cn(control, invalid && controlInvalid, className)}
        {...props}
      />
    </FieldShell>
  )
}

export function AdminTextarea({
  label,
  hint,
  error,
  required,
  wrapperClassName,
  className,
  rows = 4,
  ...props
}: BaseProps & Omit<ComponentPropsWithoutRef<"textarea">, "id">) {
  const { id, hintId, errorId, describedBy, invalid } = useFieldIds(hint, error)
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={id}
      hintId={hintId}
      errorId={errorId}
      className={wrapperClassName}
    >
      <textarea
        id={id}
        rows={rows}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        required={required}
        className={cn(control, "resize-y leading-relaxed", invalid && controlInvalid, className)}
        {...props}
      />
    </FieldShell>
  )
}

export function AdminSelect({
  label,
  hint,
  error,
  required,
  wrapperClassName,
  className,
  children,
  ...props
}: BaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & { children: ReactNode }) {
  const { id, hintId, errorId, describedBy, invalid } = useFieldIds(hint, error)
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={id}
      hintId={hintId}
      errorId={errorId}
      className={wrapperClassName}
    >
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        required={required}
        className={cn(control, "cursor-pointer pr-8", invalid && controlInvalid, className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export function AdminCheckbox({
  label,
  hint,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "type"> & { label: ReactNode; hint?: string }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink/80">
        <input
          id={id}
          type="checkbox"
          aria-describedby={hintId}
          className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
          {...props}
        />
        {label}
      </label>
      {hint && (
        <p id={hintId} className="pl-7 text-xs leading-relaxed text-ink/45">
          {hint}
        </p>
      )}
    </div>
  )
}

/** Groups related fields with a heading that screen readers announce as a group. */
export function FieldSet({
  legend,
  description,
  children,
  className,
}: {
  legend: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="label text-olive">{legend}</legend>
      {description && <p className="mt-1 text-xs leading-relaxed text-ink/45">{description}</p>}
      <div className="mt-4">{children}</div>
    </fieldset>
  )
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium " +
  "transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-55"

export const adminButtonVariants = {
  primary: "bg-brand text-on-brand hover:bg-forest",
  outline: "border border-ink/20 text-ink hover:border-brand hover:text-brand",
  ghost: "text-ink/65 hover:text-ink",
  danger: "border border-clay/40 text-clay hover:bg-clay hover:text-on-brand",
} as const

export type AdminButtonVariant = keyof typeof adminButtonVariants

export function AdminButton({
  variant = "primary",
  className,
  children,
  type = "button",
  ...props
}: { variant?: AdminButtonVariant } & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type={type}
      className={cn(buttonBase, adminButtonVariants[variant], className)}
      {...props}
    >
      {children}
    </button>
  )
}

/**
 * Submit button that reflects the pending transition. Uses useFormStatus, so it
 * knows about its own form without the page having to thread state down.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  disabled,
  ...props
}: {
  children: ReactNode
  pendingLabel?: string
  variant?: AdminButtonVariant
} & ComponentPropsWithoutRef<"button">) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={cn(buttonBase, adminButtonVariants[variant], className)}
      {...props}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {pending ? (pendingLabel ?? "Kaydediliyor…") : children}
    </button>
  )
}

/** Announces the outcome of a submission without stealing focus. */
export function FormMessage({
  state,
}: {
  state: { ok: boolean; message?: string; warning?: string }
}) {
  if (!state.message && !state.warning) return null
  return (
    <div aria-live="polite" className="space-y-2">
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "rounded-[3px] border px-3 py-2 text-sm",
            state.ok
              ? "border-brand/30 bg-brand/5 text-brand"
              : "border-clay/30 bg-clay/5 text-clay",
          )}
        >
          {state.message}
        </p>
      )}
      {state.warning && (
        <p
          role="alert"
          className="rounded-[3px] border border-shell/40 bg-shell/10 px-3 py-2 text-sm text-ink/80"
        >
          {state.warning}
        </p>
      )}
    </div>
  )
}
