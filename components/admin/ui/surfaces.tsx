import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * The dashboard's surfaces.
 *
 * Same tokens as the storefront — warm paper, hairline ink rules, the forest
 * green, the serif for figures — but tuned for operational density: smaller
 * type, tighter rhythm, less air. Panels are near-square (4px) rather than the
 * storefront's pill radius, because a table does not want to look like a
 * marketing card.
 */

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string
  description?: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: ReactNode
}) {
  return (
    <header className="mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Sayfa yolu" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink/50">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span aria-hidden="true" className="text-ink/25">
                    /
                  </span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    prefetch={false}
                    className="transition-colors duration-300 hover:text-ink"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink/70">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl leading-tight text-ink md:text-3xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export function Panel({
  title,
  description,
  actions,
  footer,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cn(
        "rounded-[4px] border border-ink/10 bg-paper/60",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-4 py-3 md:px-5">
          <div className="min-w-0">
            {title && <h2 className="label text-olive">{title}</h2>}
            {description && <p className="mt-1 text-xs text-ink/50">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("px-4 py-4 md:px-5", bodyClassName)}>{children}</div>
      {footer && <div className="border-t border-ink/10 px-4 py-3 md:px-5">{footer}</div>}
    </section>
  )
}

export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[4px] border border-dashed border-ink/15 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
      )}
    >
      <p className="font-serif text-lg text-ink/70">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/45">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = "Veriler yüklenemedi",
  description = "Bu bölüm şu anda görüntülenemiyor. Sayfayı yenilemeyi deneyin.",
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div
      role="alert"
      className="rounded-[4px] border border-clay/30 bg-clay/5 px-5 py-6 text-center"
    >
      <p className="font-serif text-lg text-clay">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/60">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function InlineAlert({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success"
  children: ReactNode
}) {
  const tones = {
    info: "border-ink/15 bg-ink/[0.03] text-ink/75",
    warning: "border-shell/40 bg-shell/10 text-ink/80",
    danger: "border-clay/30 bg-clay/5 text-clay",
    success: "border-brand/30 bg-brand/5 text-brand",
  } as const
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-[4px] border px-4 py-3 text-sm leading-relaxed", tones[tone])}
    >
      {children}
    </div>
  )
}

/** Reserves the same box the real content will occupy, so nothing jumps. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[3px] bg-ink/[0.07]", className)}
    />
  )
}

export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Yükleniyor" className="space-y-px">
      <span className="sr-only">Kayıtlar yükleniyor…</span>
      <div className="flex gap-4 border-b border-ink/10 pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-ink/[0.06] py-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3 flex-1", c === 0 && "max-w-[40%]")} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function MetricSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Yükleniyor"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-ink/10 bg-ink/10 lg:grid-cols-4"
    >
      <span className="sr-only">Ölçümler yükleniyor…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-ivory px-4 py-5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-4 h-7 w-32" />
        </div>
      ))}
    </div>
  )
}
