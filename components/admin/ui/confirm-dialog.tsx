"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { AdminButton, SubmitButton, adminButtonVariants } from "@/components/admin/ui/form"

/**
 * Confirmation for destructive and irreversible actions.
 *
 * Built on the native <dialog> element with showModal(), which gives focus
 * trapping, Escape-to-close, focus restoration to the trigger, and inert
 * background content from the platform rather than from hand-written key
 * handlers that are easy to get subtly wrong.
 *
 * `window.confirm()` is never used: it cannot show the entity being affected,
 * cannot be styled, and is suppressible by the browser.
 *
 * The dialog always names the specific record it will act on, and for the
 * gravest operations it can require the operator to type that name — deliberate
 * friction, not decoration.
 */

export function ConfirmAction({
  trigger,
  triggerVariant = "ghost",
  triggerClassName,
  title,
  description,
  entityName,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Vazgeç",
  tone = "danger",
  typedConfirmation,
  action,
  hiddenFields,
  children,
}: {
  trigger: ReactNode
  triggerVariant?: keyof typeof adminButtonVariants
  triggerClassName?: string
  title: string
  description: ReactNode
  /** The record this will affect. Always shown, so nobody confirms blind. */
  entityName?: string
  confirmLabel: string
  pendingLabel?: string
  cancelLabel?: string
  tone?: "danger" | "primary"
  /** When set, the confirm button stays disabled until this text is typed. */
  typedConfirmation?: string
  action: (formData: FormData) => void | Promise<void>
  hiddenFields?: Record<string, string>
  /** Extra inputs rendered inside the confirmation form (e.g. a reason). */
  children?: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const titleId = useId()
  const descId = useId()
  const confirmInputId = useId()

  const close = useCallback(() => {
    dialogRef.current?.close()
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onClose = () => {
      setOpen(false)
      setTyped("")
    }
    dialog.addEventListener("close", onClose)
    return () => dialog.removeEventListener("close", onClose)
  }, [])

  const confirmDisabled =
    typedConfirmation !== undefined &&
    typed.trim().toLocaleLowerCase("tr") !== typedConfirmation.trim().toLocaleLowerCase("tr")

  return (
    <>
      <AdminButton
        variant={triggerVariant}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </AdminButton>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "m-auto w-[min(30rem,calc(100vw-2rem))] rounded-[5px] border border-ink/15 bg-ivory p-0 text-ink",
          "backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]",
        )}
        // Clicking the backdrop (the dialog element itself, outside the panel)
        // dismisses, matching every other modal on the platform.
        onClick={(event) => {
          if (event.target === dialogRef.current) close()
        }}
      >
        <form action={action} className="flex flex-col">
          {hiddenFields &&
            Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}

          <div className="px-5 pb-4 pt-5">
            <h2 id={titleId} className="font-serif text-xl leading-tight">
              {title}
            </h2>
            <div id={descId} className="mt-2 text-sm leading-relaxed text-ink/65">
              {description}
            </div>

            {entityName && (
              <p className="mt-3 rounded-[3px] border border-ink/10 bg-paper/70 px-3 py-2 text-sm text-ink">
                {entityName}
              </p>
            )}

            {children && <div className="mt-4 space-y-4">{children}</div>}

            {typedConfirmation !== undefined && (
              <div className="mt-4">
                <label htmlFor={confirmInputId} className="label mb-1.5 block text-olive">
                  Onaylamak için <span className="text-ink">{typedConfirmation}</span> yazın
                </label>
                <input
                  id={confirmInputId}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  className="min-h-11 w-full rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-ink/10 px-5 py-4 sm:flex-row sm:justify-end">
            <AdminButton variant="ghost" onClick={close}>
              {cancelLabel}
            </AdminButton>
            <SubmitButton
              variant={tone === "danger" ? "danger" : "primary"}
              pendingLabel={pendingLabel}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  )
}
