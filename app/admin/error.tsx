"use client"

import { useEffect } from "react"
import Link from "next/link"

/**
 * Error boundary for the whole /admin segment.
 *
 * It exists for one case in particular: the protected *layout* failing. A
 * segment's own `error.tsx` does not catch errors thrown by the layout in that
 * same segment — only a boundary above it does — so without this file a layout
 * that cannot determine authorization would have nowhere to land.
 *
 * "Cannot determine" is exactly the state that used to be laundered into "not
 * signed in", which sent the browser to the login page, which sent it back, on
 * and on. The fix is that an indeterminate result now renders *this*: a stable
 * page, with a retry the operator chooses to press. Nothing here navigates on
 * its own, and nothing retries on a timer.
 *
 * The thrown error is logged for the operator's own devtools but never
 * rendered: a Postgres or Supabase message can carry table names, constraint
 * names and occasionally row values.
 */
export default function AdminSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin] segment error:", error)
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <p className="label text-olive">Bağlantı sorunu</p>
        <h1 className="mt-4 font-serif text-3xl leading-tight text-ink">
          Yetkiniz şu anda doğrulanamıyor
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-ink/60">
          Oturumunuz kapatılmadı. Sunucuya geçici olarak ulaşılamadığı için bu sayfa
          görüntülenemedi. Tekrar deneyebilirsiniz.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            Tekrar dene
          </button>
          <Link
            href="/"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 px-6 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
          >
            Mağazaya dön
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-ink/40">
            Hata kimliği: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  )
}
