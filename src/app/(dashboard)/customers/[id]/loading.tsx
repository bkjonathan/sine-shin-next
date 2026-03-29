export default function CustomerDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-lg bg-surface-hover" />
        <div className="h-4 w-24 rounded-lg bg-surface-hover" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4 h-24" />
        ))}
      </div>

      {/* Profile + Orders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-line bg-surface p-6 h-72" />
        <div className="rounded-2xl border border-line bg-surface p-6 h-72" />
      </div>
    </div>
  );
}
