import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  ChartSkeleton,
} from "@/components/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      {/* Financial / KPI overview */}
      <StatCardsSkeleton count={4} />

      {/* Charts + recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartSkeleton className="lg:col-span-2" />
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-5 w-32 rounded-md" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
              <Skeleton className="h-4 w-14 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
