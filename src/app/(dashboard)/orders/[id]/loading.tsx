import { Skeleton } from "@/components/ui/skeleton";
import { StatCardsSkeleton } from "@/components/skeletons";

export default function OrderDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
      </div>

      {/* Status Timeline */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
              {i < 3 && <Skeleton className="mx-2 h-0.5 flex-1 rounded-full" />}
            </div>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <StatCardsSkeleton count={4} />

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
