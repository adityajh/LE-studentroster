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
  const isOverdueTab     = tab === "overdue"
  const isOfferedTab     = tab === "offered"
  const isOnboardingTab  = tab === "onboarding"

  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })
  const isAdmin = dbUser?.role === "ADMIN"

  // Count badges for tabs
  const [offeredCount, onboardingCount] = await Promise.all([
    prisma.student.count({ where: { status: "OFFERED" } }),
    prisma.student.count({ where: { status: "ONBOARDING" } }),
  ])

  const batches = await prisma.batch.findMany({ orderBy: { year: "desc" }, select: { year: true, name: true } })

  const students = await getStudents({
    search,
    status: isOverdueTab
      ? undefined
      : isOfferedTab
      ? "OFFERED"
      : isOnboardingTab
      ? "ONBOARDING"
      : status,
    batchYear: batch ? parseInt(batch) : undefined,
    overdueOnly: isOverdueTab,
  })

  function abbrevProgram(name: string): string {
    const dashMatch = name.match(/Working BBA\s*[-–]\s*(.+)/i)
    if (dashMatch) return dashMatch[1].trim()
    const parenMatch = name.match(/^(.+?)\s*\(/)
    if (parenMatch) return parenMatch[1].trim()
    return name
  }

  const tabs = [
    { label: "All Students", value: undefined },
    { label: `Offers${offeredCount > 0 ? ` (${offeredCount})` : ""}`, value: "offered" },
    { label: `Onboarding${onboardingCount > 0 ? ` (${onboardingCount})` : ""}`, value: "onboarding" },
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
            {isOverdueTab ? " with overdue payments" : isOfferedTab ? " with pending offers" : isOnboardingTab ? " in onboarding" : " total"}
          </p>
        </div>
        {!!dbUser && (
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
          const active = isOfferedTab
            ? t.value === "offered"
            : isOnboardingTab
            ? t.value === "onboarding"
            : isOverdueTab
            ? t.value === "overdue"
            : !t.value
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
      {!isOverdueTab && !isOfferedTab && !isOnboardingTab && (
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
            <option value="ONBOARDING">Onboarding</option>
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
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Roll No</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Student</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Prog</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Net Fee</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Received</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Pending</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Next Due Amt</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Next Due Date</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const totalReceived = (s.payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
                const netFeeNum = s.financial ? Number(s.financial.netFee) : 0
                const totalPending = Math.max(0, netFeeNum - totalReceived)
                const overdueCount = s.installments.filter((i) => i.status === "OVERDUE").length

                // FIFO: walk installments by year and allocate total payments.
                // First installment with pending > 0 is the "next due".
                // (Using installment.paidAmount alone is unreliable — payments
                // sometimes link to a different installment than the one they
                // actually clear, so paidAmount can exceed amount.)
                // When registration is tracked as a flag rather than a year=0
                // installment, consume the reg fee out of total payments first
                // — matches the Schedule tab's synthetic-reg logic.
                const hasRegInstallment = s.installments.some((i) => i.year === 0)
                let fifoRemaining = totalReceived
                if (!hasRegInstallment && s.financial?.registrationPaid) {
                  const regFee = s.financial.registrationFeeOverride != null
                    ? Number(s.financial.registrationFeeOverride)
                    : Number(s.program?.registrationFee ?? 0)
                  fifoRemaining = Math.max(0, fifoRemaining - regFee)
                }
                const fifo = s.installments.map((i) => {
                  const fee = Number(i.amount)
                  const received = Math.min(fifoRemaining, fee)
                  fifoRemaining -= received
                  return { ...i, fee, pending: Math.max(0, fee - received) }
                })
                const nextDue = fifo.find((i) => i.pending > 0) ?? null
                const nextDueAmt = nextDue?.pending ?? null
                const nextDueDateStr = nextDue?.dueDate
                  ? new Date(nextDue.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                  : null
                const isNextDueOverdue = nextDue?.status === "OVERDUE"
                const statusStyle = formatStudentStatus(s.status)

                return (
                  <tr key={s.id} className={cn(
                    "border-b border-slate-50 transition-all duration-150 group",
                    overdueCount > 0
                      ? "border-l-2 border-l-rose-400 bg-rose-50/30 hover:bg-rose-50/50"
                      : "hover:bg-slate-50/80 hover:border-l-2 hover:border-l-[#3663AD]"
                  )}>
                    <td className="px-3 py-3">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {s.rollNo ?? <span className="text-violet-400 font-sans">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3 max-w-[160px]">
                      <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                      <p className="text-[11px] font-medium text-slate-400 truncate">{s.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">{abbrevProgram(s.program.name)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm font-bold text-slate-800 whitespace-nowrap">
                        {s.financial ? formatINR(s.financial.netFee) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm font-semibold text-emerald-700 whitespace-nowrap">
                        {s.financial ? formatINR(totalReceived) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-sm font-semibold whitespace-nowrap ${totalPending > 0 ? "text-rose-600" : "text-slate-400"}`}>
                        {s.financial ? formatINR(totalPending) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {nextDueAmt !== null ? (
                        <span className={`text-sm font-bold whitespace-nowrap ${isNextDueOverdue ? "text-rose-600" : "text-slate-800"}`}>
                          {formatINR(nextDueAmt)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {nextDueDateStr ? (
                        <span className={`text-sm font-medium whitespace-nowrap ${isNextDueOverdue ? "text-rose-600" : "text-slate-600"}`}>
                          {nextDueDateStr}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border",
                        statusStyle.classes
                      )}>
                        {statusStyle.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
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
