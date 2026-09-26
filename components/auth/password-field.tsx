"use client"

import { useId, useState, type ComponentPropsWithoutRef } from "react"
import { cn } from "@/lib/utils"
import { PASSWORD_MAX_LENGTH, STRENGTH_TEXT, passwordStrength } from "@/lib/auth/password-policy"

/**
 * The site's hairline field with a text Göster/Gizle control. The toggle
 * keeps focus where it is and names what it does for screen readers.
 *
 * `strength` adds one quiet line under the field: the 8-character rule until
 * it is met, then a single word. Guidance only — the server enforces the
 * length rule and nothing else.
 */
export function PasswordField({
  label,
  error,
  strength = false,
  value,
  onValueChange,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "id" | "type" | "value" | "onChange"> & {
  label: string
  error?: string
  strength?: boolean
  value: string
  onValueChange: (value: string) => void
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const hintId = strength ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined
  const level = passwordStrength(value)

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="label text-olive">
        {label}
      </label>
      <div
        className={cn(
          "flex items-center border-b transition-colors duration-300 focus-within:border-brand",
          error ? "border-clay focus-within:border-clay" : "border-ink/20",
        )}
      >
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          maxLength={PASSWORD_MAX_LENGTH}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "auth-field h-12 min-w-0 flex-1 bg-transparent px-0 py-3 text-base text-ink placeholder:text-ink/35 focus:outline-none disabled:opacity-55",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={id}
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
          className="ml-3 inline-flex min-h-11 shrink-0 items-center text-sm text-brand transition-colors duration-300 hover:text-forest"
        >
          {visible ? "Gizle" : "Göster"}
        </button>
      </div>
      {strength && (
        <p
          id={hintId}
          aria-live="polite"
          className={cn("mt-2 text-xs", level === "weak" ? "text-clay" : "text-ink/50")}
        >
          {STRENGTH_TEXT[level]}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs text-clay">
          {error}
        </p>
      )}
    </div>
  )
}
