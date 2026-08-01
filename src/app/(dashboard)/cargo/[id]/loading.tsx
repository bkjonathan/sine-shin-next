import { Skeleton } from "@/components/ui/skeleton";
import { StatCardsSkeleton } from "@/components/skeletons";

export default function CargoDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40 rounded-lg" />
          <Skeleton className="h-4 w-56 max-w-[70vw] rounded" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* Summary stats */}
      <StatCardsSkeleton count={4} />

      {/* Main content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-line bg-surface p-6 space-y-4">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6 space-y-4">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
