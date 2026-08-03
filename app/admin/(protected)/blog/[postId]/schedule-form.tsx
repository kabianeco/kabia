"use client"

import { useActionState, useState } from "react"
import { scheduleBlogPostAction } from "../actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { FormMessage, SubmitButton } from "@/components/admin/ui/form"

/** Minimal inline form: pick a future date/time, submit, server validates it is actually in the future. */
export function ScheduleForm({ postId }: { postId: string }) {
  const [state, formAction] = useActionState(scheduleBlogPostAction, ACTION_IDLE)
  const [value, setValue] = useState("")

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="postId" value={postId} />
      <div>
        <label htmlFor="scheduled_at" className="label mb-1.5 block text-olive">
          Yayın tarihi
        </label>
        <input
          id="scheduled_at"
          type="datetime-local"
          name="scheduled_at"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-11 rounded-[3px] border border-ink/15 bg-ivory px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
        />
      </div>
      <SubmitButton variant="outline" pendingLabel="Zamanlanıyor…">
        Zamanla
      </SubmitButton>
      {state.fieldErrors?.scheduled_at && (
        <p role="alert" className="w-full text-xs text-clay">
          {state.fieldErrors.scheduled_at}
        </p>
      )}
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  )
}
