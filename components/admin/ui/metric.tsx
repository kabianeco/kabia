import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * Headline figures.
 *
 * Set in the serif with tabular numerals, the same treatment prices get on the
 * storefront — figures read as material here too. Restrained in size: this is
 * an operational panel, not a hero.
 */

export function MetricGrid({
  children,
  columns = 4,
}: {
  children: ReactNode
  columns?: 2 | 3 | 4
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-ink/10 bg-ink/10",
        columns === 4 && "lg:grid-cols-4",
        columns === 3 && "lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  )
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: "default" | "brand" | "warning" | "danger"
  href?: string
}) {
  const tones = {
    default: "text-ink",
    brand: "text-brand",
    warning: "text-shell",
    danger: "text-clay",
  } as const

  const body = (
    <>
      <p className="label text-olive">{label}</p>
      <p className={cn("figure mt-3 text-2xl leading-none md:text-3xl", tones[tone])}>{value}</p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-ink/45">{hint}</p>}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        // The target is a force-dynamic admin page; a prefetched payload is
        // instantly stale, so prefetching only multiplies server renders.
        prefetch={false}
        className="group bg-ivory px-4 py-5 transition-colors duration-300 hover:bg-paper/60"
      >
        {body}
        <span className="mt-2 inline-block text-xs text-brand opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          Detaylar →
        </span>
      </Link>
    )
  }

  return <div className="bg-ivory px-4 py-5">{body}</div>
}
