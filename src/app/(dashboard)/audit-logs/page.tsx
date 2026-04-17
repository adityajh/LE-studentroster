import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { History, UserCircle, Calendar, FileEdit, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import Link from "next/link"

const PAGE_SIZE = 50

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { role: true },
  })
  if (dbUser?.role !== "ADMIN") redirect("/dashboard")

  const { search, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const q = search?.trim() ?? ""

  const where = q
    ? {
        OR: [
          { student: { name: { contains: q, mode: "insensitive" as const } } },
          { student: { rollNo: { contains: q, mode: "insensitive" as const } } },
          { field: { contains: q, mode: "insensitive" as const } },
          { oldValue: { contains: q, mode: "insensitive" as const } },
          { newValue: { contains: q, mode: "insensitive" as const } },
          { reason: { contains: q, mode: "insensitive" as const } },
          { changedByUser: { name: { contains: q, mode: "insensitive" as const } } },
          { changedByUser: { email: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {}

  const [total, logs] = await Promise.all([
    prisma.studentAuditLog.count({ where }),
    prisma.studentAuditLog.findMany({
      where,
      include: {
        student: { select: { rollNo: true, name: true } },
        changedByUser: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set("search", q)
    if (p > 1) params.set("page", String(p))
    const qs = params.toString()
    return `/audit-logs${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-950 tracking-tight">System Changelog</h1>
        <p className="text-sm font-medium text-slate-500">Global audit trail of student modifications</p>
      </header>

      {/* Search */}
      <form method="GET" action="/audit-logs" className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            name="search"
            defaultValue={q}
            placeholder="Search student, field, value, moderator…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3663AD]/30 focus:border-[#3663AD]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[#3663AD] hover:bg-[#160E44] text-white text-sm font-bold rounded-xl transition-colors"
        >
          Search
        </button>
        {q && (
          <Link
            href="/audit-logs"
            className="px-4 py-2 border border-slate-200 text-slate-500 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Results summary */}
      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
        <span>
          {total === 0
            ? "No results"
            : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} entries${q ? ` matching "${q}"` : ""}`}
        </span>
        {totalPages > 1 && (
          <span>Page {page} of {totalPages}</span>
        )}
      </div>

      <div className="bg-white border-2 border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Timestamp</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Moderator</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Student</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Change Details</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => (
                <tr key={log.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-300" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {format(new Date(log.createdAt), "dd MMM yyyy")}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400">
                          {format(new Date(log.createdAt), "HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-indigo-400" />
                      <div>
                        <p className="text-xs font-bold text-slate-700">{log.changedByUser.name}</p>
                        <p className="text-[10px] font-medium text-slate-400 lowercase">{log.changedByUser.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{log.student.name}</p>
                      <p className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tight">{log.student.rollNo}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <FileEdit className="h-3 w-3 text-emerald-500" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">{log.field}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 line-through truncate max-w-[120px]">
                          {log.oldValue || "empty"}
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold truncate max-w-[120px]">
                          {log.newValue || "empty"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className={cn(
                      "text-[11px] font-medium leading-relaxed italic",
                      log.reason ? "text-slate-600" : "text-slate-300"
                    )}>
                      {log.reason || "No reason provided"}
                    </p>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <History className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400">
                      {q ? `No entries matching "${q}"` : "No audit logs found"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/30">
            <Link
              href={pageUrl(page - 1)}
              aria-disabled={page <= 1}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                page <= 1
                  ? "text-slate-300 pointer-events-none"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…")
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm">…</span>
                  ) : (
                    <Link
                      key={p}
                      href={pageUrl(p as number)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors",
                        p === page
                          ? "bg-[#3663AD] text-white"
                          : "text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {p}
                    </Link>
                  )
                )}
            </div>
            <Link
              href={pageUrl(page + 1)}
              aria-disabled={page >= totalPages}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                page >= totalPages
                  ? "text-slate-300 pointer-events-none"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
