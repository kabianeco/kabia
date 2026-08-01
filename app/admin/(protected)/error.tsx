"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ErrorState } from "@/components/admin/ui/surfaces"

/**
 * Error boundary for the dashboard.
 *
 * The thrown error is logged to the console for the operator's own devtools but
 * is never rendered: a Postgres or Supabase message can carry table names,
 * constraint names and occasionally row values. The digest is shown instead, so
 * a report can be correlated with the server log without leaking anything.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin] render error:", error)
  }, [error])

  return (
    <div className="mx-auto max-w-lg py-12">
      <ErrorState
        title="Bir şeyler ters gitti"
        description="Bu bölüm görüntülenemedi. Tekrar deneyebilir ya da panele dönebilirsiniz."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
            >
              Tekrar dene
            </button>
            <Link
              href="/admin"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-5 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
            >
              Genel bakışa dön
            </Link>
          </div>
        }
      />
      {error.digest && (
        <p className="mt-4 text-center text-xs text-ink/40">
          Hata kimliği: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </div>
  )
}
