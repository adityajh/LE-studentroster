export default function SettingsLoading() {
  return (
    <div className="space-y-8 max-w-[1000px] animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 bg-slate-200 rounded-full" />
        <div className="h-8 w-40 bg-slate-200 rounded-xl" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 pb-0">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 w-24 bg-slate-100 rounded-t-lg" />
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        <div className="h-5 w-32 bg-slate-200 rounded" />
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-b border-slate-100 px-6 py-5 flex justify-between items-center">
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full bg-slate-100" />
                <div className="space-y-1.5">
                  <div className="h-3 w-36 bg-slate-200 rounded" />
                  <div className="h-2.5 w-24 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-7 w-20 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
