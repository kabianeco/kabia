import { Skeleton, TableSkeleton } from "@/components/admin/ui/surfaces"

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-8 w-56" />
        <Skeleton className="mt-3 h-3 w-80 max-w-full" />
      </div>
      <div className="mb-5 rounded-[4px] border border-ink/10 bg-paper/40 px-4 py-3">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-11 w-56" />
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>
      <div className="rounded-[4px] border border-ink/10 bg-paper/60 px-4 py-4 md:px-5">
        <TableSkeleton />
      </div>
    </div>
  )
}
