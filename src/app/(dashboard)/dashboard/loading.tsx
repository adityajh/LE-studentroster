export default function DashboardLoading() {
  return (
    <div className="space-y-8 max-w-[1200px] animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-20 bg-slate-200 rounded-full" />
        <div className="h-8 w-40 bg-slate-200 rounded-xl" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-3">
            <div className="h-3 w-24 bg-slate-100 rounded-full" />
            <div className="h-8 w-16 bg-slate-200 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Content rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 h-64">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="space-y-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex gap-3 items-center">
                  <div className="h-3 w-full bg-slate-100 rounded" />
                  <div className="h-3 w-20 bg-slate-100 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
