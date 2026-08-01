import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ── Building blocks ─────────────────────────────────────────────── */

/** Matches <PageHeader>: title, description, optional action button. */
export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-44 rounded-lg" />
        <Skeleton className="h-4 w-64 max-w-[70vw] rounded-md" />
      </div>
      {action && <Skeleton className="h-10 w-36 rounded-xl" />}
    </div>
  );
}

/** Row of search input + filter pills, as used on list pages. */
export function FilterBarSkeleton({ pills = 5 }: { pills?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: pills }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
    </div>
  );
}

/** A card grid of stat tiles. */
export function StatCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl border border-line bg-surface p-4"
        >
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

/** A table card with a header row and body rows. */
export function TableSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Header */}
      <div className="hidden gap-4 border-b border-line px-5 py-3.5 sm:flex">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-4 rounded", i === 0 ? "w-32 flex-none" : "flex-1")}
          />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-4">
            <div className="flex flex-1 items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
            </div>
            {Array.from({ length: Math.max(cols - 2, 0) }).map((_, c) => (
              <Skeleton key={c} className="hidden h-4 flex-1 rounded sm:block" />
            ))}
            <Skeleton className="h-4 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The pagination footer bar on list pages. */
export function PaginationSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-3.5">
      <Skeleton className="h-4 w-24 rounded" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/** A rounded chart/card placeholder. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-line bg-surface p-5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

/* ── Full-page compositions ──────────────────────────────────────── */

/** Standard list page: header + filters + table + pagination. */
export function ListPageSkeleton({
  pills = 5,
  cols = 5,
  rows = 8,
}: {
  pills?: number;
  cols?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton pills={pills} />
      <TableSkeleton rows={rows} cols={cols} />
      <PaginationSkeleton />
    </div>
  );
}

/** A stacked form/settings page. */
export function FormPageSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton action={false} />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: sections }).map((_, s) => (
        <div
          key={s}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6"
        >
          <Skeleton className="h-5 w-40 rounded-md" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, f) => (
              <div key={f} className="space-y-2">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
