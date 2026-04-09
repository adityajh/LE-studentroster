import Link from "next/link"
import { getStudents } from "@/lib/students"
import { formatINR } from "@/lib/fee-schedule"
import { buttonVariants } from "@/lib/button-variants"
import { cn } from "@/lib/utils"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { UserPlus, Users } from "lucide-react"
import { formatStudentStatus } from "@/lib/students"
import { Eyebrow, SoftCard, AdminCard } from "@/components/ui/brand"

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; batch?: string; tab?: string }>
}) {
  const { search, status, batch, tab } = await searchParams
  const isOverdueTab = tab === "overdue"

  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })
  const isAdmin = dbUser?.role === "ADMIN"

  const students = await getStudents({
    search,
    status: isOverdueTab ? undefined : status,
    batchYear: batch ? parseInt(batch) : undefined,
    overdueOnly: isOverdueTab,
  })

  const tabs = [
    { label: "All Students", value: undefined },
    { label: "Overdue", value: "overdue" },
  ]

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow>Master Roster</Eyebrow>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5 font-headline">Students</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {students.length} student{students.length !== 1 ? "s" : ""}
            {isOverdueTab ? " with overdue payments" : " enrolled"}
          </p>
        </div>
        {isAdmin && (
          <Link href="/students/new" className={cn(buttonVariants(), "bg-indigo-600 hover:bg-indigo-700 text-white")}>
            <UserPlus className="h-4 w-4 mr-2" />
            Enroll Student
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => {
          const active = isOverdueTab ? t.value === "overdue" : !t.value
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
      {!isOverdueTab && (
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
          <button
            type="submit"
            className="h-10 px-4 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all"
          >
            Filter
          </button>
          {(search || status) && (
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
                const overdueCount = s.installments.filter((i) => i.status === "OVERDUE").length
                const partialCount = s.installments.filter((i) => i.status === "PARTIAL").length
                const paidCount = s.installments.filter((i) => i.status === "PAID" || i.status === "PARTIAL").length
                const totalCount = s.installments.length
                const statusStyle = formatStudentStatus(s.status)

                return (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono font-bold text-slate-400">{s.rollNo}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-bold text-slate-900">{s.name}</p>
                      <p className="text-xs font-medium text-slate-400">{s.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-slate-600">{s.program.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-bold text-slate-800">
                        {s.financial ? formatINR(s.financial.netFee) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
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
                      <Link href={`/students/${s.id}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </SoftCard>
      )}
    </div>
  )
}
