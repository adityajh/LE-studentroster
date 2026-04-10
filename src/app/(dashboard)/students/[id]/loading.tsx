export default function StudentDetailLoading() {
  return (
    <div className="space-y-8 max-w-[1000px] animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="h-3 w-16 bg-slate-200 rounded" />
        <div className="h-3 w-2 bg-slate-100 rounded" />
        <div className="h-3 w-24 bg-slate-100 rounded" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-200 shrink-0" />
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-200 rounded-xl" />
            <div className="flex gap-2">
              <div className="h-5 w-20 bg-slate-100 rounded-lg" />
              <div className="h-5 w-28 bg-slate-100 rounded-lg" />
              <div className="h-5 w-20 bg-slate-100 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="h-9 w-20 bg-slate-200 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 h-40">
              <div className="h-2.5 w-16 bg-slate-100 rounded" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex gap-2 items-center">
                  <div className="h-4 w-4 bg-slate-100 rounded shrink-0" />
                  <div className="h-3 w-full bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex gap-2">
              <div className="h-7 w-32 bg-slate-100 rounded-lg" />
              <div className="h-7 w-24 bg-slate-100 rounded-lg" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-slate-50 flex justify-between items-center">
                <div className="space-y-1.5 flex-1">
                  <div className="flex gap-2">
                    <div className="h-3 w-32 bg-slate-200 rounded" />
                    <div className="h-5 w-16 bg-slate-100 rounded-lg" />
                  </div>
                  <div className="h-2.5 w-24 bg-slate-100 rounded" />
                </div>
                <div className="h-5 w-24 bg-slate-200 rounded font-mono" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
