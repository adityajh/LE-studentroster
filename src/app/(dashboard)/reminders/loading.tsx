export default function RemindersLoading() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-slate-200 rounded-xl" />
        <div className="h-3 w-64 bg-slate-100 rounded" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-3xl p-6">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-slate-100" />
              <div className="space-y-1.5">
                <div className="h-2.5 w-20 bg-slate-100 rounded" />
                <div className="h-7 w-10 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Templates */}
      <div className="space-y-4">
        <div className="h-5 w-48 bg-slate-200 rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-32 space-y-3">
            <div className="flex gap-3">
              <div className="h-5 w-20 bg-slate-100 rounded-full" />
              <div className="h-5 w-32 bg-slate-100 rounded-full" />
            </div>
            <div className="h-3 w-48 bg-slate-100 rounded" />
            <div className="h-12 w-full bg-slate-50 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
