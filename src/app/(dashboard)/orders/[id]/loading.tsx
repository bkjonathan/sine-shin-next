export default function OrderDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-surface-hover" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-32 rounded-lg bg-surface-hover" />
          <div className="h-4 w-48 rounded-lg bg-surface-hover" />
        </div>
      </div>

      {/* Status Timeline */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-10 w-10 rounded-full bg-surface-hover" />
                <div className="h-3 w-16 rounded bg-surface-hover" />
              </div>
              {i < 3 && <div className="mx-2 h-0.5 flex-1 rounded-full bg-surface-hover" />}
            </div>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4 h-24" />
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-line bg-surface p-6 h-64" />
          <div className="rounded-2xl border border-line bg-surface p-6 h-80" />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-6 h-48" />
          <div className="rounded-2xl border border-line bg-surface p-6 h-40" />
          <div className="rounded-2xl border border-line bg-surface p-6 h-56" />
        </div>
      </div>
    </div>
  );
}
