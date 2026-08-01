import { Skeleton } from "@/components/ui/skeleton";
import { StatCardsSkeleton } from "@/components/skeletons";

export default function CustomerDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-40 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
      </div>

      {/* Stats */}
      <StatCardsSkeleton count={4} />

      {/* Profile + Orders */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
