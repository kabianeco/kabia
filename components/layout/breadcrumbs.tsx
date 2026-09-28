import Link from "next/link"
import { breadcrumbJsonLd } from "@/lib/seo"

export interface Crumb {
  label: string
  href: string
}

/**
 * The visible trail and its BreadcrumbList, built from the same items so the
 * two cannot disagree. The last item is the current page. Markup as the
 * journal entries have always rendered it.
 */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/70">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === items.length - 1 ? (
              <span aria-current="page" className="truncate text-ink/60">
                {item.label}
              </span>
            ) : (
              <Link href={item.href} prefetch={false} className="transition-colors duration-300 hover:text-ink">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {/* The same trail, for search engines — built from the visible items. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd(items.map((item) => [item.label, item.href] as const))),
        }}
      />
    </nav>
  )
}
