import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * Ranked magnitude, as a table with a bar drawn in one cell.
 *
 * A server component with no JavaScript: the value is printed next to every
 * bar, so there is nothing a tooltip would reveal that is not already on
 * screen, and a screen reader gets a plain label/value table rather than an SVG
 * it has to be told how to interpret.
 *
 * One hue for every bar. Rank is encoded by length and by row order — never by
 * colour, which must stay attached to the entity rather than to its position.
 */

export interface BarListItem {
  id: string
  label: string
  value: number
  /** Printed to the right of the value — units, a share, a secondary measure. */
  secondary?: string
  href?: string
}

export function BarList({
  items,
  caption,
  valueLabel,
  formatValue,
  emptyMessage,
}: {
  items: BarListItem[]
  caption: string
  valueLabel: string
  formatValue: (value: number) => string
  emptyMessage: string
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-ink/45">{emptyMessage}</p>
  }

  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Ad</th>
          <th scope="col">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const share = Math.max(2, Math.round((item.value / max) * 100))
          return (
            <tr key={item.id} className="align-middle">
              <th
                scope="row"
                className="w-1/2 max-w-0 py-2 pr-3 text-left font-normal text-ink/80"
              >
                <span className="block truncate">
                  {item.href ? (
                    <Link
                      href={item.href}
                      prefetch={false}
                      className="transition-colors duration-200 hover:text-brand"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                </span>
              </th>
              <td className="py-2">
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="h-2 flex-1 overflow-hidden rounded-[2px] bg-ink/[0.06]"
                  >
                    <div
                      className="h-full rounded-[2px] bg-brand"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <span className="figure w-auto shrink-0 whitespace-nowrap text-right text-ink">
                    {formatValue(item.value)}
                  </span>
                  {item.secondary && (
                    <span className="w-16 shrink-0 text-right text-xs text-ink/45">
                      {item.secondary}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * The same idea for a small set of fixed buckets (order statuses), where the
 * label is the meaning and colour would only get in the way.
 */
export function DistributionList({
  items,
  caption,
  total,
}: {
  items: { id: string; label: string; value: number; href?: string }[]
  caption: string
  total: number
}) {
  if (total === 0) {
    return <p className="py-6 text-center text-sm text-ink/45">Henüz sipariş yok.</p>
  }

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Durum</th>
          <th scope="col">Sipariş sayısı</th>
          <th scope="col">Pay</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          return (
            <tr key={item.id}>
              <th scope="row" className="py-2 pr-3 text-left font-normal text-ink/80">
                {item.href ? (
                  <Link
                    href={item.href}
                    prefetch={false}
                    className="transition-colors duration-200 hover:text-brand"
                  >
                    {item.label}
                  </Link>
                ) : (
                  item.label
                )}
              </th>
              <td className="py-2">
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="h-2 flex-1 overflow-hidden rounded-[2px] bg-ink/[0.06]"
                  >
                    <div
                      className={cn("h-full rounded-[2px] bg-brand")}
                      style={{ width: `${Math.max(pct, item.value > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="figure w-10 shrink-0 text-right text-ink">{item.value}</span>
                  <span className="figure w-14 shrink-0 text-right text-xs text-ink/45">
                    %{pct.toFixed(0)}
                  </span>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
