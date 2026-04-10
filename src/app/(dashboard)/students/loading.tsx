export default function StudentsLoading() {
  return (
    <div className="space-y-6 max-w-[1200px] animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-slate-200 rounded-full" />
          <div className="h-8 w-32 bg-slate-200 rounded-xl" />
          <div className="h-3 w-28 bg-slate-100 rounded-full" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-xl" />
      </div>

      {/* Tab pills */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <div className="h-8 w-28 bg-slate-200 rounded-lg" />
        <div className="h-8 w-20 bg-slate-100 rounded-lg" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="h-10 w-72 bg-slate-200 rounded-xl" />
        <div className="h-10 w-36 bg-slate-200 rounded-xl" />
        <div className="h-10 w-20 bg-slate-200 rounded-xl" />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 flex gap-4">
          {["w-16", "w-32", "w-28", "w-24", "w-24", "w-20"].map((w, i) => (
            <div key={i} className={`h-3 ${w} bg-slate-100 rounded`} />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border-b border-slate-50 px-5 py-4 flex gap-4 items-center">
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-36 bg-slate-200 rounded" />
              <div className="h-2.5 w-24 bg-slate-100 rounded" />
            </div>
            <div className="h-3 w-28 bg-slate-100 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="h-5 w-16 bg-slate-100 rounded-lg" />
            <div className="h-5 w-16 bg-slate-100 rounded-lg" />
            <div className="h-3 w-10 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
