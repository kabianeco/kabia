/**
 * SEC-03 regression tests: structured, log-forgery-resistant admin logging.
 *
 * Replaces the previous `console.error(`[admin] ${context}:`, error)` pattern,
 * which used caller-supplied `context` as part of the format string. A caller
 * controlling `context` could inject printf placeholders, newlines, terminal
 * control sequences, or arbitrarily long framing into server logs.
 *
 * These tests assert the four documented properties of the new logger at
 * `lib/admin/log.ts`:
 *   - constant log message ("admin.error"), context treated as data
 *   - CRLF/control-character injection stripped
 *   - context length bounded
 *   - errors serialized safely (no raw Error object reaches util.format)
 */
import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { logAdminError } from "../lib/admin/log.ts"

interface CapturedLine {
  format: unknown[]
  output: () => string
}

let captured: CapturedLine[] = []
let originalError: typeof console.error

beforeEach(() => {
  captured = []
  originalError = console.error
  console.error = ((...args: unknown[]) => {
    const chunks: string[] = []
    chunks.push((args[0] as string) ?? "")
    for (let i = 1; i < args.length; i++) {
      const v = args[i]
      if (typeof v === "string") chunks.push(v)
      else {
        try {
          chunks.push(JSON.stringify(v))
        } catch {
          chunks.push("[unserializable]")
        }
      }
    }
    captured.push({ format: args, output: () => chunks.join(" ") })
  }) as typeof console.error
})

afterEach(() => {
  console.error = originalError
})

function lastLine(): CapturedLine | undefined {
  return captured.at(-1)
}

describe("SEC-03 admin logging", () => {
  it("uses a constant log message and serializes context as data, not as the format string", () => {
    logAdminError({ context: "saveProduct", error: new Error("boom") })
    const line = lastLine()!
    // The literal format string is exactly "admin.error" — caller never
    // becomes the format string. Anything after is a single JSON string.
    assert.equal(line.format[0], "admin.error", "format string must be the constant 'admin.error'")
    assert.equal(line.format.length, 2, "must call console.error with exactly two args (format + payload)")
    const payload = JSON.parse(line.format[1] as string)
    assert.equal(payload.context, "saveProduct")
    assert.equal(payload.error.name, "Error")
    assert.equal(payload.error.message, "boom")
  })

  it("treats context containing %s/%j as data, not as a printf placeholder", () => {
    // If context were the format string, util.format would substitute %-tokens
    // against subsequent args. The new logger must not allow that.
    logAdminError({ context: "ev%s", error: "INJECTED-VIA-PRINTF" })
    const line = lastLine()!
    assert.equal(line.format[0], "admin.error")
    assert.equal(line.format.length, 2)
    const payload = JSON.parse(line.format[1] as string)
    // The raw "%s" stays as literal characters in the context data field.
    assert.match(payload.context, /ev.*s/)
    // And the error's value is serialized into the JSON payload, not consumed
    // as a printf argument.
    assert.equal(payload.error.value, "INJECTED-VIA-PRINTF")
  })

  it("strips CR/LF/NUL and other C0 control chars from context and messages", () => {
    const forgedContext = "save\r\n[admin] FAKE-LINE\n\x00\x1binjected"
    const error = new Error("real-error\n\r[admin] FAKE-LINE-2\x1b[31mred\x1b[0m")
    logAdminError({ context: forgedContext, error })
    const line = lastLine()!
    const payload = JSON.parse(line.format[1] as string)
    assert.doesNotMatch(payload.context, /[\r\n\x00\x1b]/, "context must have CR/LF/NUL/ESC removed")
    assert.doesNotMatch(payload.error.message, /[\r\n\x1b]/, "error message must have CR/LF/ESC removed")
    // Forgery is the absence of extra log entries / extra lines: a payload
    // that contains literal "FAKE-LINE" text after CR/LF stripping is acceptable
    // so long as it cannot break onto its own line or be mistaken for a
    // different log entry.
    assert.doesNotMatch(line.format[1] as string, /\n/, "JSON payload must be a single line")
    assert.equal(captured.length, 1, "one log call must produce exactly one cosnole.error call")
  })

  it("bounds context length when caller exceeds the maximum", () => {
    const huge = "x".repeat(10_000)
    logAdminError({ context: huge, error: new Error("e") })
    const payload = JSON.parse(lastLine()!.format[1] as string)
    assert.ok(
      typeof payload.context === "string" && payload.context.length <= 220,
      `context must be bounded, got ${payload.context.length}`,
    )
  })

  it("serializes Postgres/PostgREST-like error shape safely", () => {
    const pgErr = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
      details: "Key (email)=(a@b.c) already exists.",
      hint: undefined as unknown,
    })
    logAdminError({ context: "saveUser", error: pgErr })
    const payload = JSON.parse(lastLine()!.format[1] as string)
    assert.equal(payload.error.code, "23505")
    assert.equal(payload.error.name, "Error")
    assert.match(payload.error.message, /duplicate key value/)
    // The details field is sanitized of any control char.
    assert.doesNotMatch(payload.error.details ?? "", /[\r\n]/)
  })

  it("serializes authentication errors without leaking token/cookie data", () => {
    const err = new Error("Auth session missing")
    // An attacker may have stuffed secret-shaped strings into the message
    // elsewhere; ensure we neither drop the message nor echo it raw past a
    // bound.
    logAdminError({ context: "adminLogin", error: err })
    const payload = JSON.parse(lastLine()!.format[1] as string)
    assert.equal(payload.error.message, "Auth session missing")
    // No cookie/token-shaped field is added by the logger.
    assert.ok(!("cookie" in payload) && !("token" in payload), "logger must not fabricate secret fields")
  })

  it("handles unknown thrown values (string, number, plain object, null) without throwing", () => {
    const cases: unknown[] = [
      "plain string error",
      42,
      { foo: "bar", nested: { x: 1 } },
      null,
      undefined,
      circular(),
    ]
    for (const c of cases) {
      assert.doesNotThrow(() => logAdminError({ context: "ok", error: c }))
    }
    // All produced one line each.
    assert.equal(captured.length, cases.length)
  })

  it("emits exactly one log line per call regardless of injected newlines", () => {
    logAdminError({ context: "a\nb\rc\nd", error: new Error("e\nf\rg") })
    assert.equal(captured.length, 1, "one log call must produce exactly one console.error call")
    const line = lastLine()!.format[1] as string
    assert.doesNotMatch(line, /\n/, "JSON payload must itself contain no literal newline chars")
  })
})

function circular(): unknown {
  const o: Record<string, unknown> = { a: 1 }
  o.self = o
  return o
}