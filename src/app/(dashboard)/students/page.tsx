import Link from "next/link"
import { getStudents } from "@/lib/students"
import { formatINR } from "@/lib/fee-schedule"
import { buttonVariants } from "@/lib/button-variants"
import { cn } from "@/lib/utils"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { UserPlus, Users, Send } from "lucide-react"
import { formatStudentStatus } from "@/lib/students"
import { Eyebrow, SoftCard, AdminCard } from "@/components/ui/brand"

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; batch?: string; tab?: string }>
}) {
  const { search, status, batch, tab } = await searchParams
  const isOverdueTab = tab === "overdue"
  const isOfferedTab = tab === "offered"

  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })
  const isAdmin = dbUser?.role === "ADMIN"

  // Count pending offers for tab badge
  const offeredCount = await prisma.student.count({ where: { status: "OFFERED" } })

  const batches = await prisma.batch.findMany({ orderBy: { year: "desc" }, select: { year: true, name: true } })

  const students = await getStudents({
    search,
    status: isOverdueTab ? undefined : isOfferedTab ? "OFFERED" : status,
    batchYear: batch ? parseInt(batch) : undefined,
    overdueOnly: isOverdueTab,
  })

  const now = new Date()

  const tabs = [
    { label: "All Students", value: undefined },
    { label: `Offers${offeredCount > 0 ? ` (${offeredCount})` : ""}`, value: "offered" },
    { label: "Overdue", value: "overdue" },
  ]

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Master Roster</Eyebrow>
          <h1 className="text-3xl font-black text-slate-900 mt-0.5 font-headline tracking-tight">Students</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {students.length} student{students.length !== 1 ? "s" : ""}
            {isOverdueTab ? " with overdue payments" : isOfferedTab ? " with pending offers" : " total"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link href="/students/offer/new" className={cn(buttonVariants(), "bg-[#160E44] hover:bg-[#3663AD] text-white transition-colors duration-200")}>
              <Send className="h-4 w-4 mr-2" />
              Create Offer
            </Link>
            <Link href="/students/new" className={cn(buttonVariants(), "bg-[#3663AD] hover:bg-[#25BCBD] text-white transition-colors duration-200")}>
              <UserPlus className="h-4 w-4 mr-2" />
              Enroll Directly
            </Link>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => {
          const active = isOfferedTab ? t.value === "offered" : isOverdueTab ? t.value === "overdue" : !t.value
          const href = t.value ? `/students?tab=${t.value}` : "/students"
          return (
            <Link
              key={t.label}
              href={href}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      {/* Filters — only on All tab */}
      {!isOverdueTab && !isOfferedTab && (
        <form method="GET" className="flex gap-3 flex-wrap">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search name, email, roll no…"
            className="h-10 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all w-72"
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none transition-all"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ALUMNI">Alumni</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
          <select
            name="batch"
            defaultValue={batch ?? ""}
            className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none transition-all"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.year} value={b.year}>{b.name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 px-4 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all"
          >
            Filter
          </button>
          {(search || status || batch) && (
            <Link href="/students" className="h-10 px-4 flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
              Clear
            </Link>
          )}
        </form>
      )}

      {/* Table */}
      {students.length === 0 ? (
        <SoftCard className="p-16 text-center">
          <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">
            {isOverdueTab ? "No overdue payments" : "No students found"}
          </p>
          <p className="text-xs font-medium text-slate-400 mt-1">
            {isOverdueTab
              ? "All installments are on track"
              : search || status
              ? "Try adjusting your filters"
              : "Enroll the first student to get started"}
          </p>
        </SoftCard>
      ) : (
        <SoftCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Roll No</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Student</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Program</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Net Fee</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Payments</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const isOffered = s.status === "OFFERED"
                const overdueCount = s.installments.filter((i) => i.status === "OVERDUE").length
                const partialCount = s.installments.filter((i) => i.status === "PARTIAL").length
                const paidCount = s.installments.filter((i) => i.status === "PAID" || i.status === "PARTIAL").length
                const totalCount = s.installments.length
                const statusStyle = formatStudentStatus(s.status)

                // Offer expiry countdown
                const offerExpiry = s.offerExpiresAt ? new Date(s.offerExpiresAt) : null
                const daysLeft = offerExpiry
                  ? Math.ceil((offerExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <tr key={s.id} className={cn(
                    "border-b border-slate-50 transition-all duration-150 group",
                    overdueCount > 0
                      ? "border-l-2 border-l-rose-400 bg-rose-50/30 hover:bg-rose-50/50"
                      : "hover:bg-slate-50/80 hover:border-l-2 hover:border-l-[#3663AD]"
                  )}>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {s.rollNo ?? <span className="text-violet-400 font-sans">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-bold text-slate-900 whitespace-nowrap">{s.name}</p>
                      <p className="text-xs font-medium text-slate-400">{s.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-slate-600 whitespace-nowrap">{s.program.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-bold text-slate-800 whitespace-nowrap">
                        {s.financial ? formatINR(s.financial.netFee) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {isOffered ? (
                        <div className="flex items-center gap-1.5">
                          {daysLeft === null ? (
                            <span className="text-xs font-medium text-slate-400">No email sent</span>
                          ) : daysLeft < 0 ? (
                            <span className={`inline-flex items-center gap-1 ${s.offerRevised ? "bg-orange-500/10 text-orange-700 border-orange-500/20" : "bg-slate-500/10 text-slate-600 border-slate-500/20"} border text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded`}>
                              {s.offerRevised ? "Lapsed" : "Expired"}
                            </span>
                          ) : daysLeft <= 1 ? (
                            <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-700 border border-rose-500/20 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded">
                              Expires today
                            </span>
                          ) : daysLeft <= 3 ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded">
                              {daysLeft}d left
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-violet-500/10 text-violet-700 border border-violet-500/20 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded">
                              {daysLeft}d left
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {overdueCount > 0 && (
                            <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-700 border border-rose-500/20 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded">
                              {overdueCount} overdue
                            </span>
                          )}
                          {partialCount > 0 && (
                            <span className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-700 border border-orange-500/20 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded">
                              {partialCount} partial
                            </span>
                          )}
                          {overdueCount === 0 && partialCount === 0 && (
                            <span className="text-xs font-medium text-slate-400">
                              {paidCount}/{totalCount} paid
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        "inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border",
                        statusStyle.classes
                      )}>
                        {statusStyle.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/students/${s.id}`} className="text-xs font-semibold text-[#3663AD] hover:text-[#160E44] transition-colors whitespace-nowrap">
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </SoftCard>
      )}
    </div>
  )
}
