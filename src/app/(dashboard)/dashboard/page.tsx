import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { formatINR } from "@/lib/fee-schedule"
import { cn } from "@/lib/utils"
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  IndianRupee,
  Send,
  UserCheck,
  FileText,
  Calendar,
  ChevronRight,
  ArrowRight,
  AlertCircle,
} from "lucide-react"
import { SoftCard, Eyebrow } from "@/components/ui/brand"

async function getDashboardData() {
  const now = new Date()

  // Financial Year calculations (India: April 1 - March 31)
  const currentMonth = now.getMonth() // 0-indexed (0 = Jan, 3 = Apr)
  const fyStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const fyStart = new Date(fyStartYear, 3, 1, 0, 0, 0)
  const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59)

  const nextFyStart = new Date(fyStartYear + 1, 3, 1, 0, 0, 0)
  const nextFyEnd = new Date(fyStartYear + 2, 2, 31, 23, 59, 59)

  const fyLabel = `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`
  const nextFyLabel = `FY ${fyStartYear + 1}-${(fyStartYear + 2).toString().slice(-2)}`

  const [
    totalStudents,
    pendingOffersCount,
    overdueInstallments,
    dueThisFyInstallments,
    collectedThisFyAgg,
    dueNextFyInstallments,
    allFinancials,
    recentPayments,
    // Funnel counts
    funnelOffered,
    funnelLinkSent,
    funnelSubmitted,
    funnelActive,
    // Attention items
    pendingOnboardings,
    expiringOffers,
  ] = await Promise.all([
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.student.count({ where: { status: "OFFERED" } }),

    // Overdue: full details for list. Excludes WITHDRAWN.
    prisma.installment.findMany({
      where: {
        status: "OVERDUE",
        student: {
          status: { not: "WITHDRAWN" },
        },
      },
      include: { student: { select: { id: true, name: true, rollNo: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),

    // Due this FY — unpaid/partially paid installments due in this financial year
    prisma.installment.findMany({
      where: {
        dueDate: { gte: fyStart, lte: fyEnd },
        status: { not: "PAID" },
        student: {
          status: { not: "WITHDRAWN" },
        },
      },
    }),

    // Collected this FY — payments recorded in this financial year
    prisma.payment.aggregate({
      where: {
        date: { gte: fyStart, lte: fyEnd },
        student: { status: { not: "WITHDRAWN" } },
      },
      _sum: { amount: true },
    }),

    // Due next FY — unpaid/partially paid installments due in next financial year
    prisma.installment.findMany({
      where: {
        dueDate: { gte: nextFyStart, lte: nextFyEnd },
        status: { not: "PAID" },
        student: {
          status: { not: "WITHDRAWN" },
        },
      },
    }),

    // All financials for overall collection rate
    prisma.studentFinancial.findMany({
      where: { student: { status: "ACTIVE" } },
      select: { netFee: true, student: { select: { program: { select: { registrationFee: true } } } } },
    }),

    // Recent payments — last 8
    prisma.installment.findMany({
      where: {
        status: { in: ["PAID", "PARTIAL"] },
        paidDate: { not: null },
      },
      include: { student: { select: { id: true, name: true, rollNo: true } } },
      orderBy: { paidDate: "desc" },
      take: 8,
    }),

    // Admission & Onboarding Funnel
    prisma.student.count({ where: { status: "OFFERED", selfOnboardingStatus: "NOT_STARTED" } }),
    prisma.student.count({ where: { selfOnboardingStatus: "LINK_SENT" } }),
    prisma.student.count({ where: { selfOnboardingStatus: "SUBMITTED" } }),
    prisma.student.count({ where: { status: "ACTIVE" } }),

    // Pending onboardings (submitted, awaiting approval)
    prisma.student.findMany({
      where: { selfOnboardingStatus: "SUBMITTED" },
      select: { id: true, name: true, rollNo: true, selfOnboardingSubmittedAt: true, email: true },
      orderBy: { selfOnboardingSubmittedAt: "desc" },
      take: 5,
    }),

    // Expiring offers (OFFERED status with expiration)
    prisma.student.findMany({
      where: {
        status: "OFFERED",
        offerExpiresAt: { not: null },
      },
      select: { id: true, name: true, offerExpiresAt: true, email: true },
      orderBy: { offerExpiresAt: "asc" },
      take: 5,
    }),
  ])

  const overdueAmount = overdueInstallments.reduce((s, i) => s + i.amount.toNumber(), 0)
  const dueThisFyAmount = dueThisFyInstallments.reduce((s, i) => {
    const remaining = i.amount.toNumber() - (i.paidAmount?.toNumber() ?? 0)
    return s + Math.max(0, remaining)
  }, 0)
  const collectedThisFyAmount = collectedThisFyAgg._sum.amount?.toNumber() ?? 0
  const dueNextFyAmount = dueNextFyInstallments.reduce((s, i) => {
    const remaining = i.amount.toNumber() - (i.paidAmount?.toNumber() ?? 0)
    return s + Math.max(0, remaining)
  }, 0)

  const totalNetFee = allFinancials.reduce(
    (s, f) => s + f.netFee.toNumber() + Number(f.student.program.registrationFee),
    0
  )

  const paymentAgg = await prisma.payment.aggregate({
    where: { student: { status: "ACTIVE" } },
    _sum: { amount: true },
  })
  const totalCollected = paymentAgg._sum.amount?.toNumber() ?? 0
  const collectionRate = totalNetFee > 0 ? Math.round((totalCollected / totalNetFee) * 100) : 0

  // FIRST_N offer progress
  const firstNOffers = await prisma.offer.findMany({
    where: {
      type: "FIRST_N",
      firstNLimit: { not: null },
    },
    select: {
      id: true,
      name: true,
      firstNLimit: true,
      waiverAmount: true,
      feeSchedule: { select: { batch: { select: { year: true } } } },
      _count: {
        select: {
          studentOffers: {
            where: { student: { status: { not: "WITHDRAWN" } } },
          },
        },
      },
    },
    orderBy: [{ feeSchedule: { batch: { year: "desc" } } }, { name: "asc" }],
  })

  const firstNProgress = firstNOffers.map((o) => ({
    id: o.id,
    name: o.name,
    batchYear: o.feeSchedule.batch.year,
    limit: o.firstNLimit!,
    taken: o._count.studentOffers,
    waiverAmount: o.waiverAmount.toNumber(),
  }))

  return {
    totalStudents,
    pendingOffers: pendingOffersCount,
    overdueInstallments,
    overdueAmount,
    overdueCount: overdueInstallments.length,
    fyLabel,
    nextFyLabel,
    fyStartYear,
    dueThisFyAmount,
    collectedThisFyAmount,
    dueNextFyAmount,
    collectionRate,
    totalCollected,
    totalNetFee,
    recentPayments,
    firstNProgress,
    funnel: {
      offered: funnelOffered,
      linkSent: funnelLinkSent,
      submitted: funnelSubmitted,
      active: funnelActive,
      total: funnelOffered + funnelLinkSent + funnelSubmitted + funnelActive,
    },
    pendingOnboardings,
    expiringOffers,
  }
}

export default async function DashboardPage() {
  const d = await getDashboardData()

  const statCards = [
    {
      eyebrow: "Active Students",
      value: d.totalStudents,
      sub: "Currently enrolled",
      icon: Users,
      accent: "indigo" as const,
      href: "/students",
    },
    {
      eyebrow: "Pending Offers",
      value: d.pendingOffers,
      sub: d.pendingOffers > 0 ? "Awaiting registration payment" : "No open offers",
      icon: Send,
      accent: "violet" as const,
      href: "/students?tab=offered",
    },
    {
      eyebrow: `Collected (${d.fyLabel})`,
      value: formatINR(d.collectedThisFyAmount),
      sub: "Received this financial year",
      icon: IndianRupee,
      accent: "emerald" as const,
      isAmount: true,
      href: `/students?collectedFy=${d.fyStartYear}`,
    },
    {
      eyebrow: `Due (${d.fyLabel})`,
      value: formatINR(d.dueThisFyAmount),
      sub: "Receivable this financial year",
      icon: Clock,
      accent: "amber" as const,
      isAmount: true,
      href: `/students?dueFy=${d.fyStartYear}`,
    },
    {
      eyebrow: `Due (${d.nextFyLabel})`,
      value: formatINR(d.dueNextFyAmount),
      sub: "Receivable next financial year",
      icon: Calendar,
      accent: "indigo" as const,
      isAmount: true,
      href: `/students?dueFy=${d.fyStartYear + 1}`,
    },
    {
      eyebrow: "Overdue Amount",
      value: formatINR(d.overdueAmount),
      sub: d.overdueCount > 0 ? `${d.overdueCount} payments overdue` : "All clear",
      icon: AlertTriangle,
      accent: "rose" as const,
      isAmount: true,
      href: "/students?tab=overdue",
    },
  ]

  const accentStyles = {
    indigo:  { icon: "bg-[#3663AD]/10 text-[#3663AD]",    value: "text-[#3663AD]" },
    violet:  { icon: "bg-[#160E44]/10 text-[#160E44]",    value: "text-[#160E44]" },
    rose:    { icon: "bg-rose-500/10 text-rose-600",       value: "text-rose-600" },
    amber:   { icon: "bg-amber-500/10 text-amber-600",     value: "text-amber-600" },
    emerald: { icon: "bg-emerald-500/10 text-emerald-600", value: "text-emerald-600" },
  }

  const today = new Date()

  // Calculate funnel percentages
  const funnelMax = Math.max(
    d.funnel.offered,
    d.funnel.linkSent,
    d.funnel.submitted,
    d.funnel.active,
    1
  )

  const funnelSteps = [
    { label: "Offers Issued", count: d.funnel.offered, color: "bg-violet-500", text: "text-violet-600" },
    { label: "Onboarding Sent", count: d.funnel.linkSent, color: "bg-amber-500", text: "text-amber-600" },
    { label: "Form Submitted", count: d.funnel.submitted, color: "bg-blue-500", text: "text-blue-600" },
    { label: "Enrolled & Active", count: d.funnel.active, color: "bg-emerald-500", text: "text-emerald-600" },
  ]

  const totalAttentionItems = d.overdueCount + d.pendingOnboardings.length + d.expiringOffers.length

  return (
    <div className="space-y-8 max-w-[1200px]">
      <div>
        <Eyebrow>Overview</Eyebrow>
        <h1 className="text-3xl font-black text-slate-900 mt-0.5 font-headline tracking-tight">Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const styles = accentStyles[card.accent]
          const inner = (
            <SoftCard className="p-5">
              <div className="flex items-start justify-between mb-3">
                <Eyebrow>{card.eyebrow}</Eyebrow>
                <div className={`rounded-xl p-2 ${styles.icon}`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <p className={`font-black font-headline ${card.isAmount ? "text-2xl" : "text-3xl"} ${styles.value}`}>
                {card.value}
              </p>
              {card.sub && <p className="text-xs font-medium text-slate-400 mt-1">{card.sub}</p>}
            </SoftCard>
          )
          return card.href ? (
            <Link key={card.eyebrow} href={card.href}>{inner}</Link>
          ) : (
            <div key={card.eyebrow}>{inner}</div>
          )
        })}
      </div>

      {/* Admissions & Onboarding Funnel */}
      <SoftCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Eyebrow>Pipeline</Eyebrow>
            <h2 className="text-lg font-extrabold text-slate-900 font-headline mt-0.5">
              Admissions & Onboarding Funnel
            </h2>
          </div>
          <Link
            href="/students"
            className="text-xs font-bold text-[#3663AD] hover:text-[#160E44] flex items-center gap-1 transition-colors"
          >
            Manage Students <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {funnelSteps.map((step, idx) => {
            const pct = Math.round((step.count / funnelMax) * 100)
            return (
              <div key={step.label} className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500">{step.label}</span>
                  <span className={`text-xl font-black font-headline ${step.text}`}>{step.count}</span>
                </div>
                <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${step.color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {idx < funnelSteps.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-300">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </SoftCard>

      {/* Collection rate bar */}
      <SoftCard className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Eyebrow>Overall Collection Rate</Eyebrow>
            <p className="text-sm font-semibold text-slate-600 mt-0.5">
              {formatINR(d.totalCollected)} collected of {formatINR(d.totalNetFee)} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-2xl font-black text-emerald-600">{d.collectionRate}%</span>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(d.collectionRate, 100)}%`,
              background: "linear-gradient(90deg, #3663AD 0%, #25BCBD 100%)",
            }}
          />
        </div>
      </SoftCard>

      {/* Attention Needed Section */}
      <SoftCard className="p-0 overflow-hidden border-rose-100/80">
        <div className="px-5 py-4 bg-rose-50/40 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <Eyebrow className="text-rose-600">Action Items</Eyebrow>
              <h2 className="text-base font-extrabold text-slate-900 mt-0.5 font-headline">Attention Needed</h2>
            </div>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
            {totalAttentionItems} pending
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Overdue Payments */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> Overdue Payments ({d.overdueCount})
              </span>
              {d.overdueCount > 0 && (
                <Link href="/students?tab=overdue" className="text-[11px] font-bold text-[#3663AD] hover:underline">
                  View all →
                </Link>
              )}
            </div>
            {d.overdueCount === 0 ? (
              <div className="py-6 text-center text-slate-400">
                <CheckCircle className="h-6 w-6 mx-auto mb-1.5 text-emerald-400" />
                <p className="text-xs font-semibold text-slate-500">No overdue payments</p>
              </div>
            ) : (
              <div className="space-y-2">
                {d.overdueInstallments.slice(0, 4).map((inst) => {
                  const daysOverdue = Math.floor(
                    (today.getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <Link
                      key={inst.id}
                      href={`/students/${inst.student.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 truncate">{inst.student.name}</p>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                          {inst.label} · {daysOverdue}d overdue
                        </p>
                      </div>
                      <span className="text-xs font-extrabold text-rose-600 shrink-0">{formatINR(inst.amount)}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pending Onboarding Submissions */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-500" /> Pending Approvals ({d.pendingOnboardings.length})
              </span>
              <Link href="/students" className="text-[11px] font-bold text-[#3663AD] hover:underline">
                Students →
              </Link>
            </div>
            {d.pendingOnboardings.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                <CheckCircle className="h-6 w-6 mx-auto mb-1.5 text-emerald-400" />
                <p className="text-xs font-semibold text-slate-500">No pending document reviews</p>
              </div>
            ) : (
              <div className="space-y-2">
                {d.pendingOnboardings.map((student) => (
                  <Link
                    key={student.id}
                    href={`/students/${student.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{student.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">Form submitted · Review docs</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                      Review
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Expiring Offers */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-amber-500" /> Expiring Offers ({d.expiringOffers.length})
              </span>
              <Link href="/students?tab=offered" className="text-[11px] font-bold text-[#3663AD] hover:underline">
                View offered →
              </Link>
            </div>
            {d.expiringOffers.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                <CheckCircle className="h-6 w-6 mx-auto mb-1.5 text-emerald-400" />
                <p className="text-xs font-semibold text-slate-500">No offers expiring soon</p>
              </div>
            ) : (
              <div className="space-y-2">
                {d.expiringOffers.map((student) => {
                  const expiryDate = student.offerExpiresAt ? new Date(student.offerExpiresAt) : null
                  const daysLeft = expiryDate
                    ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    : null
                  return (
                    <Link
                      key={student.id}
                      href={`/students/${student.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 truncate">{student.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {daysLeft !== null
                            ? daysLeft < 0
                              ? "Expired"
                              : `${daysLeft} days left`
                            : "No deadline"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded border",
                          daysLeft !== null && daysLeft <= 2
                            ? "bg-rose-50 text-rose-600 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        Follow up
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </SoftCard>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent payments */}
        <SoftCard className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <Eyebrow>Activity</Eyebrow>
            <h2 className="text-base font-extrabold text-slate-900 mt-0.5 font-headline">Recent Payments</h2>
          </div>
          {d.recentPayments.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <IndianRupee className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">No payments recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {d.recentPayments.map((inst) => {
                const amount = inst.paidAmount?.toNumber() ?? inst.amount.toNumber()
                const isPartial = inst.status === "PARTIAL"
                return (
                  <Link
                    key={inst.id}
                    href={`/students/${inst.student.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">{inst.student.name}</p>
                        {isPartial && (
                          <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
                            Partial
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                        {inst.label}
                        {inst.paidDate && ` · ${new Date(inst.paidDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-600">{formatINR(amount)}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </SoftCard>

        {/* First-N offer progress — render if available */}
        {d.firstNProgress.length > 0 ? (
          <SoftCard className="p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <Eyebrow>Offers</Eyebrow>
                <h2 className="text-base font-extrabold text-slate-900 mt-0.5 font-headline">First-N Offer Progress</h2>
                <p className="text-xs text-slate-500 mt-0.5">Awarded automatically to the first N students in the batch to pay their Year 1 fee.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {d.firstNProgress.map((o) => {
                const remaining = Math.max(0, o.limit - o.taken)
                const pct = o.limit > 0 ? Math.min(100, Math.round((o.taken / o.limit) * 100)) : 0
                const full = remaining === 0
                return (
                  <div key={o.id} className="border border-slate-200/60 rounded-xl p-3 bg-white">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="text-sm font-extrabold text-slate-800 truncate">{o.name}</p>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 shrink-0">LE{o.batchYear}</span>
                    </div>
                    <div className="flex items-end justify-between gap-3 mb-2">
                      <p className="text-2xl font-black text-slate-900 leading-none">
                        {o.taken}<span className="text-slate-300 text-lg font-bold"> / {o.limit}</span>
                      </p>
                      <span className={cn(
                        "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border",
                        full ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}>
                        {full ? "Filled" : `${remaining} left`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all", full ? "bg-rose-400" : "bg-emerald-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">Waiver: {formatINR(o.waiverAmount)} each</p>
                  </div>
                )
              })}
            </div>
          </SoftCard>
        ) : (
          <SoftCard className="p-5 flex flex-col justify-center items-center text-center">
            <UserCheck className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">No active First-N offers</p>
            <p className="text-xs text-slate-400 mt-1">Offers created with first-N limits will show progress here.</p>
          </SoftCard>
        )}
      </div>
    </div>
  )
}

