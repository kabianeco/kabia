"use client"

import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { CODE_LENGTH, enterDigits, eraseDigit, joinDigits, typedText } from "@/lib/auth/code"

/**
 * The e-mail code as CODE_LENGTH digit boxes. One hidden input carries the
 * joined value under `name`, so the surrounding <form> posts a single field.
 *
 * Typing a digit fills the box and moves on; Backspace clears and steps back;
 * ←/→, Home and End move between boxes; a paste or the platform's one-time
 * code autofill fills every box at once. The boxes are one labelled group and
 * each box names its position for screen readers.
 */
export function CodeInput({
  name,
  label,
  digits,
  onDigitsChange,
  error,
  disabled,
  autoFocus,
}: {
  name: string
  label: string
  digits: string[]
  onDigitsChange: (digits: string[]) => void
  error?: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  const id = useId()
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  const boxes = useRef<Array<HTMLInputElement | null>>([])

  const focusBox = (index: number) => {
    const box = boxes.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))]
    box?.focus()
    box?.select()
  }

  const apply = (next: { digits: string[]; focus: number }) => {
    onDigitsChange(next.digits)
    focusBox(next.focus)
  }

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault()
      apply(eraseDigit(digits, index))
    } else if (event.key === "Delete") {
      event.preventDefault()
      onDigitsChange(digits.map((d, i) => (i === index ? "" : d)))
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      focusBox(index - 1)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      focusBox(index + 1)
    } else if (event.key === "Home") {
      event.preventDefault()
      focusBox(0)
    } else if (event.key === "End") {
      event.preventDefault()
      focusBox(CODE_LENGTH - 1)
    }
  }

  const onPaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    apply(enterDigits(digits, index, event.clipboardData.getData("text")))
  }

  return (
    <div>
      <p id={labelId} className="label text-olive">
        {label}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        className="mt-4 grid gap-2 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${CODE_LENGTH}, minmax(0, 1fr))` }}
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            // The first box receives the platform's one-time-code autofill,
            // which arrives as the whole code and is spread by onChange.
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && index === 0}
            aria-label={`${index + 1}. hane / ${CODE_LENGTH}`}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            value={digit}
            onChange={(event) => apply(enterDigits(digits, index, typedText(digit, event.target.value)))}
            onKeyDown={onKeyDown(index)}
            onPaste={onPaste(index)}
            onFocus={(event) => event.target.select()}
            className={cn(
              // auth-field drops the global outline: the box's own border is the
              // focus mark, thickened by an inset hairline so it reads as 2px.
              "auth-field figure h-14 w-full min-w-0 rounded-theme-input border bg-transparent text-center text-2xl text-ink",
              "transition-colors duration-300 focus:border-brand focus:shadow-[inset_0_0_0_1px_var(--color-brand)] focus:outline-none disabled:opacity-55",
              error ? "border-clay" : "border-ink/20",
            )}
          />
        ))}
      </div>
      <input type="hidden" name={name} value={joinDigits(digits)} />
      {error && (
        <p id={errorId} className="mt-3 text-sm text-clay">
          {error}
        </p>
      )}
    </div>
  )
}
