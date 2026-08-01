import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * Table primitives.
 *
 * Deliberately low-level rather than a generic <DataTable columns={...} />:
 * every admin list has a different idea of what a row looks like on a phone,
 * and a configuration object would have ended up more code than composition.
 *
 * Responsive contract, applied by every screen that uses these:
 *   - the real table is `hidden md:table`, wrapped in TableScroll so a wide
 *     table scrolls *inside its own box* on tablets rather than pushing the
 *     page sideways;
 *   - below md, the same data renders as RecordCard list items.
 */

export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0", className)}>{children}</div>
  )
}

export function Table({
  children,
  caption,
  className,
}: {
  children: ReactNode
  /** Screen-reader description of what the table contains. */
  caption: string
  className?: string
}) {
  return (
    <table className={cn("w-full min-w-[44rem] border-collapse text-sm", className)}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  )
}

export function Th({
  children,
  align = "left",
  className,
  scope = "col",
  width,
}: {
  children: ReactNode
  align?: "left" | "right" | "center"
  className?: string
  scope?: "col" | "row"
  width?: string
}) {
  return (
    <th
      scope={scope}
      style={width ? { width } : undefined}
      className={cn(
        "label border-b border-ink/10 px-3 pb-3 pt-0 font-medium text-olive",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = "left",
  className,
  numeric = false,
}: {
  children: ReactNode
  align?: "left" | "right" | "center"
  className?: string
  /** Renders in the serif with tabular numerals, like prices elsewhere on the site. */
  numeric?: boolean
}) {
  return (
    <td
      className={cn(
        "border-b border-ink/[0.07] px-3 py-3.5 align-middle text-ink/80",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "figure text-ink",
        className,
      )}
    >
      {children}
    </td>
  )
}

export function Tr({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <tr className={cn("transition-colors duration-200 hover:bg-ink/[0.02]", className)}>
      {children}
    </tr>
  )
}

/** The phone-sized representation of one row. */
export function RecordCard({
  title,
  meta,
  href,
  children,
  actions,
}: {
  title: ReactNode
  meta?: ReactNode
  href?: string
  children?: ReactNode
  actions?: ReactNode
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-ink">{title}</div>
          {meta && <div className="mt-1 text-xs text-ink/50">{meta}</div>}
        </div>
      </div>
      {children && <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">{children}</dl>}
    </>
  )

  return (
    <li className="rounded-[4px] border border-ink/10 bg-paper/50 p-4">
      {href ? (
        <Link
          href={href}
          prefetch={false}
          className="block rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {body}
        </Link>
      ) : (
        body
      )}
      {actions && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
          {actions}
        </div>
      )}
    </li>
  )
}

export function RecordField({
  label,
  children,
  numeric = false,
}: {
  label: string
  children: ReactNode
  numeric?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="label text-olive">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm text-ink/80", numeric && "figure text-ink")}>
        {children}
      </dd>
    </div>
  )
}

export function RecordList({ children }: { children: ReactNode }) {
  return <ul className="grid gap-3 md:hidden">{children}</ul>
}

/**
 * Server-rendered pagination. Links rather than buttons, so a page is
 * shareable, works without JavaScript and is keyboard-navigable by default.
 */
export function Pagination({
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
  if (total === 0) return null

  const first = (page - 1) * perPage + 1
  const last = Math.min(page * perPage, total)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const linkClass =
    "inline-flex min-h-11 items-center rounded-full border border-ink/15 px-4 text-sm text-ink/75 transition-colors duration-300 hover:border-brand hover:text-brand"
  const disabledClass =
    "inline-flex min-h-11 cursor-not-allowed items-center rounded-full border border-ink/[0.08] px-4 text-sm text-ink/30"

  return (
    <nav
      aria-label="Sayfalama"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-xs text-ink/50" aria-live="polite">
        <span className="figure text-ink/70">{first}</span>–
        <span className="figure text-ink/70">{last}</span> / toplam{" "}
        <span className="figure text-ink/70">{total}</span> kayıt
      </p>

      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link href={buildHref(page - 1)} prefetch={false} rel="prev" className={linkClass}>
            ← Önceki
          </Link>
        ) : (
          <span className={disabledClass} aria-hidden="true">
            ← Önceki
          </span>
        )}
        <span className="px-1 text-xs text-ink/50">
          <span className="figure">{page}</span> / <span className="figure">{totalPages}</span>
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
      </div>
    </nav>
  )
}

/** Column header that also toggles sort direction, as a link. */
export function SortableTh({
  children,
  field,
  activeField,
  activeDir,
  buildHref,
  align = "left",
}: {
  children: ReactNode
  field: string
  activeField?: string
  activeDir: "asc" | "desc"
  buildHref: (field: string, dir: "asc" | "desc") => string
  align?: "left" | "right" | "center"
}) {
  const isActive = activeField === field
  const nextDir: "asc" | "desc" = isActive && activeDir === "desc" ? "asc" : "desc"
  return (
    <Th align={align}>
      <Link
        href={buildHref(field, nextDir)}
        prefetch={false}
        aria-sort={isActive ? (activeDir === "asc" ? "ascending" : "descending") : "none"}
        className={cn(
          "inline-flex items-center gap-1 transition-colors duration-300 hover:text-ink",
          isActive && "text-ink",
        )}
      >
        {children}
        <span aria-hidden="true" className={cn("text-[0.7em]", !isActive && "opacity-30")}>
          {isActive && activeDir === "asc" ? "▲" : "▼"}
        </span>
        {isActive && (
          <span className="sr-only">
            {activeDir === "asc" ? "artan sırada" : "azalan sırada"}
          </span>
        )}
      </Link>
    </Th>
  )
}
