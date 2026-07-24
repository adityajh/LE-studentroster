import Link from "next/link"
import { getStudents } from "@/lib/students"
import { formatINR } from "@/lib/fee-schedule"
import { computeFeeLedger } from "@/lib/fee-ledger"
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
  searchParams: Promise<{ search?: string; status?: string; batch?: string; tab?: string; dueFy?: string; collectedFy?: string }>
}) {
  const { search, status, batch, tab, dueFy, collectedFy } = await searchParams
  const isOverdueTab     = tab === "overdue"
  const isOfferedTab     = tab === "offered"
  const isOnboardingTab  = tab === "onboarding"
  const dueFyYear        = dueFy ? parseInt(dueFy) : undefined
  const collectedFyYear  = collectedFy ? parseInt(collectedFy) : undefined

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
    dueFyYear,
    collectedFyYear,
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
        <div className="space-y-3">
          {(dueFy || collectedFy) && (
            <div className="flex items-center justify-between bg-amber-50/90 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>
                  Showing students based on: <strong className="font-bold">{dueFyYear ? `Dues in FY ${dueFyYear}-${(dueFyYear + 1).toString().slice(-2)}` : `Payments Collected in FY ${collectedFyYear!}-${(collectedFyYear! + 1).toString().slice(-2)}`}</strong>
                </span>
              </div>
              <Link href="/students" className="text-xs text-amber-700 hover:text-amber-950 underline font-bold bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors">
                Clear Filter
              </Link>
            </div>
          )}
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
            {(search || status || batch || dueFy || collectedFy) && (
              <Link href="/students" className="h-10 px-4 flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
                Clear
              </Link>
            )}
          </form>
        </div>
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
              : search || status || dueFy || collectedFy
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
                {(dueFyYear || collectedFyYear) && (
                  <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-amber-700 bg-amber-50">
                    {dueFyYear
                      ? `FY ${dueFyYear.toString().slice(-2)}-${(dueFyYear + 1).toString().slice(-2)} Due`
                      : `FY ${collectedFyYear!.toString().slice(-2)}-${(collectedFyYear! + 1).toString().slice(-2)} Coll.`}
                  </th>
                )}
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Next Due Amt</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Next Due Date</th>
                <th className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const totalReceived = (s.payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
                const overdueCount = s.installments.filter((i) => i.status === "OVERDUE").length

                let fySpecificAmount = 0
                if (dueFyYear) {
                  const fyStart = new Date(dueFyYear, 3, 1, 0, 0, 0)
                  const fyEnd = new Date(dueFyYear + 1, 2, 31, 23, 59, 59)
                  fySpecificAmount = s.installments
                    .filter((i) => i.status !== "PAID" && new Date(i.dueDate) >= fyStart && new Date(i.dueDate) <= fyEnd)
                    .reduce((sum, i) => sum + (Number(i.amount) - (Number(i.paidAmount) || 0)), 0)
                } else if (collectedFyYear) {
                  const fyStart = new Date(collectedFyYear, 3, 1, 0, 0, 0)
                  const fyEnd = new Date(collectedFyYear + 1, 2, 31, 23, 59, 59)
                  fySpecificAmount = (s.payments || [])
                    .filter((p) => p.date && new Date(p.date) >= fyStart && new Date(p.date) <= fyEnd)
                    .reduce((sum, p) => sum + Number(p.amount), 0)
                }

                const ledger = computeFeeLedger({
                  totalPaid: totalReceived,
                  installments: s.installments.map((i) => ({
                    id: i.id,
                    year: i.year,
                    label: "",
                    amount: Number(i.amount),
                    dueDate: i.dueDate,
                    status: i.status,
                  })),
                  reg: s.financial?.registrationPaid
                    ? {
                        fee: s.financial.registrationFeeOverride != null
                          ? Number(s.financial.registrationFeeOverride)
                          : Number(s.program?.registrationFee ?? 0),
                        isPaid: true,
                      }
                    : undefined,
                  program: s.program ? {
                    year1Fee: Number(s.program.year1Fee),
                    year2Fee: Number(s.program.year2Fee),
                    year3Fee: Number(s.program.year3Fee),
                    installmentType: s.financial?.installmentType,
                  } : undefined,
                  waivers: {
                    offers: s.offers.map(o => ({
                      conditions: (o.offer as { conditions: unknown }).conditions,
                      waiverAmount: Number(o.waiverAmount),
                    })),
                    scholarships: s.scholarships.map(sc => ({
                      amount: Number(sc.amount),
                      spreadAcrossYears: (sc.scholarship as { spreadAcrossYears: boolean }).spreadAcrossYears,
                    })),
                    totalDeductionAmount: s.deductions.reduce((sum, d) => sum + Number(d.amount), 0),
                  },
                })
                const nextDue = ledger.nextDue
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
                        {s.financial ? formatINR(ledger.totals.fee) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm font-semibold text-emerald-700 whitespace-nowrap">
                        {s.financial ? formatINR(totalReceived) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-sm font-semibold whitespace-nowrap ${ledger.totals.pending > 0 ? "text-rose-600" : "text-slate-400"}`}>
                        {s.financial ? formatINR(ledger.totals.pending) : "—"}
                      </span>
                    </td>
                    {(dueFyYear || collectedFyYear) && (
                      <td className="px-3 py-3 bg-amber-50/50">
                        <span className="text-sm font-bold text-amber-900 whitespace-nowrap">
                          {formatINR(fySpecificAmount)}
                        </span>
                      </td>
                    )}
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
