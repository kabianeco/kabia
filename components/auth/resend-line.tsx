"use client"

import { useActionState, useEffect, useState } from "react"
import { ACTION_IDLE, type ActionState } from "@/lib/admin/errors"
import { cooldownText, secondsUntilResend, startResendCooldown, type ResendKind } from "@/lib/auth/pending"

type ResendAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

/** Seconds left on the resend cooldown, ticking once a second while locked. */
export function useResendCooldown(kind: ResendKind) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const tick = () => setSeconds(secondsUntilResend(kind))
    const first = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(interval)
    }
  }, [kind])
  return seconds
}

/**
 * "Kod gelmedi mi? Tekrar gönder" — a quiet text action under the main
 * button, never a button of its own. While the cooldown runs it is replaced
 * by plain text counting down. The result is announced politely.
 */
export function ResendLine({
  kind,
  email,
  action,
  prompt,
  sentText,
}: {
  kind: ResendKind
  email: string
  action: ResendAction
  prompt: string
  sentText: string
}) {
  const seconds = useResendCooldown(kind)
  const [state, formAction, pending] = useActionState(action, ACTION_IDLE)
  const [announced, setAnnounced] = useState("")

  useEffect(() => {
    if (state === ACTION_IDLE) return
    if (state.ok) startResendCooldown(kind)
    const update = setTimeout(() => setAnnounced(state.ok ? sentText : state.message ?? ""), 0)
    return () => clearTimeout(update)
  }, [state, kind, sentText])

  const failed = state !== ACTION_IDLE && !state.ok

  return (
    <div className="text-sm text-ink/60">
      {seconds > 0 ? (
        <p>{cooldownText(seconds)}</p>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="email" value={email} />
          {prompt}{" "}
          <button
            type="submit"
            disabled={pending || !email}
            className="inline-flex min-h-11 items-center text-brand transition-colors duration-300 hover:text-forest disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pending ? "Gönderiliyor…" : "Tekrar gönder"}
          </button>
        </form>
      )}
      <p role="status" aria-live="polite" className={failed ? "mt-1 text-clay" : "sr-only"}>
        {announced}
      </p>
    </div>
  )
}
