"use client"

import { useCallback, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Check, X, AlertCircle } from "lucide-react"
import { uploadMediaAction } from "@/app/admin/(protected)/media/actions"
import { Panel } from "@/components/admin/ui/surfaces"
import { AdminButton } from "@/components/admin/ui/form"
import { MEDIA_ACCEPT, MEDIA_MAX_BYTES, formatBytes } from "@/lib/admin/media"
import { cn } from "@/lib/utils"

/**
 * Upload surface for the media library.
 *
 * Drag-and-drop is an accelerator, never the only route: the same drop zone is
 * a real <label> bound to a real file input, so it is reachable by keyboard and
 * announced as a file control. Pointer-only upload would lock out anyone using
 * a keyboard or a screen reader, and would not work on touch at all.
 *
 * Files upload one at a time rather than in parallel. A batch of 10 MB
 * originals fired at once would compete for the same connection, make progress
 * meaningless and multiply the cost of a failure; sequential means each file
 * has a definite state and one failure does not take the batch with it.
 *
 * Client-side validation here is courtesy — it produces a fast, specific error.
 * The server re-validates everything, including sniffing the actual bytes,
 * because nothing the browser reports about a file can be trusted.
 */

type ItemStatus = "queued" | "uploading" | "done" | "error"

interface QueueItem {
  key: string
  name: string
  size: number
  status: ItemStatus
  message?: string
}

const ACCEPTED = new Set(MEDIA_ACCEPT.split(","))

function preflight(file: File): string | null {
  if (file.size === 0) return "Dosya boş."
  if (file.size > MEDIA_MAX_BYTES) return `Dosya 10 MB sınırını aşıyor (${formatBytes(file.size)}).`
  if (!ACCEPTED.has(file.type)) return "Yalnızca JPEG, PNG, WebP ve AVIF görselleri yüklenebilir."
  return null
}

export function MediaUploader() {
  const router = useRouter()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState<QueueItem[]>([])
  const [busy, setBusy] = useState(false)
  // Guards against a drag that moves over a child element firing dragleave.
  const dragDepth = useRef(0)

  const update = useCallback((key: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }, [])

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      const queued: QueueItem[] = files.map((file) => ({
        key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        name: file.name,
        size: file.size,
        status: "queued",
      }))
      setItems((prev) => [...queued, ...prev].slice(0, 40))
      setBusy(true)

      let anySucceeded = false

      for (const [index, file] of files.entries()) {
        const item = queued[index]
        const rejection = preflight(file)
        if (rejection) {
          update(item.key, { status: "error", message: rejection })
          continue
        }

        update(item.key, { status: "uploading" })
        const data = new FormData()
        data.set("file", file)

        try {
          const result = await uploadMediaAction({ ok: false }, data)
          if (result.ok) {
            anySucceeded = true
            update(item.key, { status: "done", message: undefined })
          } else {
            update(item.key, { status: "error", message: result.message ?? "Yükleme başarısız." })
          }
        } catch {
          update(item.key, { status: "error", message: "Yükleme sırasında bir hata oluştu." })
        }
      }

      setBusy(false)
      // One refresh for the whole batch, after it settles — not one per file.
      if (anySucceeded) router.refresh()
    },
    [router, update],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      void upload([...event.dataTransfer.files])
    },
    [upload],
  )

  const succeeded = items.filter((i) => i.status === "done").length
  const failed = items.filter((i) => i.status === "error").length

  return (
    <Panel
      title="Görsel yükle"
      description="JPEG, PNG, WebP veya AVIF · en fazla 10 MB · birden fazla dosya seçilebilir"
    >
      <div
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepth.current -= 1
          if (dragDepth.current <= 0) setDragging(false)
        }}
        onDrop={onDrop}
        className={cn(
          "rounded-[4px] border border-dashed p-6 text-center transition-colors duration-200",
          dragging ? "border-brand bg-brand/5" : "border-ink/20 bg-paper/40",
        )}
      >
        <Upload className="mx-auto h-6 w-6 text-ink/30" aria-hidden="true" />

        <p className="mt-3 text-sm text-ink/70">
          Görselleri buraya sürükleyin ya da{" "}
          <label
            htmlFor={inputId}
            className="cursor-pointer rounded-[2px] font-medium text-brand underline underline-offset-4 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand hover:text-forest"
          >
            dosya seçin
          </label>
        </p>
        <p className="mt-1.5 text-xs text-ink/45">
          Sürükle-bırak zorunlu değildir; dosya seçmek de aynı işi yapar.
        </p>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])]
            event.target.value = ""
            void upload(files)
          }}
        />
      </div>

      {/* The queue doubles as the live region: each file's outcome is announced
          as it resolves, rather than only appearing visually. */}
      <div aria-live="polite" aria-busy={busy || undefined} className="mt-4 space-y-2">
        {busy && (
          <p className="text-xs text-ink/55">
            Yükleniyor… ({succeeded + failed}/{items.length})
          </p>
        )}

        {items.length > 0 && (
          <ul className="space-y-1.5">
            {items.slice(0, 12).map((item) => (
              <li
                key={item.key}
                className="flex items-start gap-2.5 rounded-[3px] border border-ink/10 bg-paper/50 px-3 py-2 text-xs"
              >
                <span className="mt-0.5 shrink-0" aria-hidden="true">
                  {item.status === "done" && <Check className="h-3.5 w-3.5 text-brand" />}
                  {item.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-clay" />}
                  {item.status === "uploading" && (
                    <span className="block h-3.5 w-3.5 animate-spin rounded-full border border-ink/40 border-t-transparent motion-reduce:animate-none" />
                  )}
                  {item.status === "queued" && <span className="block h-3.5 w-3.5" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-ink/45">
                    {formatBytes(item.size)}
                    {item.status === "queued" && " · sırada"}
                    {item.status === "uploading" && " · yükleniyor"}
                    {item.status === "done" && " · yüklendi"}
                  </span>
                  {item.message && <span className="mt-0.5 block text-clay">{item.message}</span>}
                </span>

                {item.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                    aria-label={`${item.name} kaydını listeden kaldır`}
                    className="shrink-0 rounded-[2px] p-1 text-ink/35 transition-colors hover:text-ink focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-brand"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && !busy && (
          <AdminButton variant="ghost" onClick={() => setItems([])}>
            Listeyi temizle
          </AdminButton>
        )}
      </div>
    </Panel>
  )
}
