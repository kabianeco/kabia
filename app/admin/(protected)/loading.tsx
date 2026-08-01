import { MetricSkeleton, Skeleton, TableSkeleton } from "@/components/admin/ui/surfaces"

/**
 * Route-level loading state for the dashboard group.
 *
 * Reserves the same boxes the real content occupies — a title block, a metric
 * row, a table — so the layout does not jump when data arrives.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-4 h-8 w-64" />
        <Skeleton className="mt-3 h-3 w-96 max-w-full" />
      </div>
      <MetricSkeleton />
      <div className="rounded-[4px] border border-ink/10 bg-paper/60 px-4 py-4 md:px-5">
        <TableSkeleton />
      </div>
    </div>
  )
}
