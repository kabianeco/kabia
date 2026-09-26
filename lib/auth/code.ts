/**
 * The e-mail verification code, shared by the digit boxes and the server.
 *
 * Supabase sends a numeric one-time code whose length is set in the dashboard
 * (Authentication → Email → Email OTP Length). That value must equal
 * CODE_LENGTH: the UI renders this many boxes and the server rejects anything
 * else before calling Supabase.
 */
export const CODE_LENGTH = 6

const CODE_PATTERN = new RegExp(`^[0-9]{${CODE_LENGTH}}$`)

/** Exactly CODE_LENGTH ASCII digits. The server never normalizes the code. */
export function isValidCode(token: string): boolean {
  return CODE_PATTERN.test(token)
}

/**
 * The digits a person pasted or typed, in order, capped at CODE_LENGTH.
 * Only the browser uses this, so "123 456" or "Kod: 123456" still fills the
 * boxes; the submitted value is then checked strictly by isValidCode.
 */
export function digitsFrom(text: string): string {
  return text.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH)
}

export type CodeDigits = readonly string[]

export function emptyDigits(): string[] {
  return Array.from({ length: CODE_LENGTH }, () => "")
}

/**
 * Typing or pasting into box `index`. Returns the new digits and the box that
 * should take focus. A single digit fills the box and advances; several digits
 * (paste, autofill) fill forward from the box and focus the next empty one or
 * the last filled one.
 */
export function enterDigits(digits: CodeDigits, index: number, text: string): { digits: string[]; focus: number } {
  const incoming = text.replace(/[^0-9]/g, "")
  const next = [...digits]
  if (!incoming) return { digits: next, focus: index }
  // A full-length paste always starts at the first box, wherever it landed.
  const start = incoming.length >= CODE_LENGTH ? 0 : index
  let cursor = start
  for (const digit of incoming) {
    if (cursor >= CODE_LENGTH) break
    next[cursor] = digit
    cursor++
  }
  return { digits: next, focus: Math.min(cursor, CODE_LENGTH - 1) }
}

/** Backspace in box `index`: clear it, or step back and clear the previous one. */
export function eraseDigit(digits: CodeDigits, index: number): { digits: string[]; focus: number } {
  const next = [...digits]
  if (next[index]) {
    next[index] = ""
    return { digits: next, focus: index }
  }
  const previous = Math.max(0, index - 1)
  next[previous] = ""
  return { digits: next, focus: previous }
}

export function joinDigits(digits: CodeDigits): string {
  return digits.join("")
}

/**
 * What was actually typed into a box that held `previous` and now reads
 * `raw`. A whole code (autofill, some keyboards' paste) is kept intact; when
 * a second digit lands next to the old one, the old one is dropped.
 */
export function typedText(previous: string, raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "")
  if (digits.length >= CODE_LENGTH || !previous || digits.length !== 2) return digits
  return digits.startsWith(previous) ? digits.slice(1) : digits.slice(0, 1)
}
