import Link from "next/link"

/** Bounded "more posts" navigation — Önceki/Sonraki, server-rendered links. */
export function BlogPagination({
  page,
  perPage,
  total,
  buildHref,
}: {
  page: number
  perPage: number
  total: number
  buildHref: (page: number) => string
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  if (totalPages <= 1) return null

  const hasPrev = page > 1
  const hasNext = page < totalPages

  const linkClass =
    "inline-flex min-h-11 items-center rounded-theme-button border border-ink/15 px-5 text-sm text-ink/75 transition-colors duration-300 hover:border-brand hover:text-brand"
  const disabledClass = "inline-flex min-h-11 cursor-not-allowed items-center rounded-theme-button border border-ink/[0.08] px-5 text-sm text-ink/30"

  return (
    <nav aria-label="Sayfalama" className="mt-4 flex items-center justify-between gap-3">
      {hasPrev ? (
        <Link href={buildHref(page - 1)} prefetch={false} rel="prev" className={linkClass}>
          ← Önceki
        </Link>
      ) : (
        <span className={disabledClass} aria-hidden="true">
          ← Önceki
        </span>
      )}
      <span className="text-xs text-ink/45">
        Sayfa <span className="figure text-ink/70">{page}</span> / <span className="figure text-ink/70">{totalPages}</span>
      </span>
      {hasNext ? (
        <Link href={buildHref(page + 1)} prefetch={false} rel="next" className={linkClass}>
          Sonraki →
        </Link>
      ) : (
        <span className={disabledClass} aria-hidden="true">
          Sonraki →
        </span>
      )}
    </nav>
  )
}
