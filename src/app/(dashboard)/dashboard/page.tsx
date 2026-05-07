import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { formatINR } from "@/lib/fee-schedule"
import { formatInstallmentStatus } from "@/lib/students"
import { cn } from "@/lib/utils"
import { Users, AlertTriangle, Clock, CheckCircle, TrendingUp, IndianRupee, Send } from "lucide-react"
import { SoftCard, Eyebrow } from "@/components/ui/brand"

async function getDashboardData() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [
    totalStudents,
    pendingOffers,
    overdueInstallments,
    dueThisMonthInstallments,
    paidThisMonthInstallments,
    allFinancials,
    recentPayments,
  ] = await Promise.all([
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.student.count({ where: { status: "OFFERED" } }),

    // Overdue: full details for list (exclude WITHDRAWN students)
    prisma.installment.findMany({
      where: {
        status: "OVERDUE",
        student: { status: { not: "WITHDRAWN" } },
      },
      include: { student: { select: { id: true, name: true, rollNo: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),

    // Due this month (exclude WITHDRAWN students)
    prisma.installment.findMany({
      where: {
        status: { in: ["DUE", "UPCOMING"] },
        dueDate: { gte: monthStart, lte: monthEnd },
        student: { status: { not: "WITHDRAWN" } },
      },
    }),

    // Paid this month
    prisma.installment.findMany({
      where: {
        status: { in: ["PAID", "PARTIAL"] },
        paidDate: { gte: monthStart, lte: monthEnd },
      },
    }),

    // All financials for collection rate
    prisma.studentFinancial.findMany({
      where: { student: { status: "ACTIVE" } },
      select: { netFee: true },
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
  ])

  const overdueAmount = overdueInstallments.reduce((s, i) => s + i.amount.toNumber(), 0)
  const dueThisMonthAmount = dueThisMonthInstallments.reduce((s, i) => s + i.amount.toNumber(), 0)
  const collectedThisMonth = paidThisMonthInstallments.reduce(
    (s, i) => s + (i.paidAmount?.toNumber() ?? i.amount.toNumber()),
    0
  )

  const totalNetFee = allFinancials.reduce((s, f) => s + f.netFee.toNumber(), 0)

  // Total collected ever — use Payment table (source of truth).
  // The installment.paidAmount field is only populated for PARTIAL payments,
  // so aggregating it misses fully-paid installments entirely.
  const paymentAgg = await prisma.payment.aggregate({
    where: { student: { status: "ACTIVE" } },
    _sum: { amount: true },
  })
  const totalCollected = paymentAgg._sum.amount?.toNumber() ?? 0
  const collectionRate = totalNetFee > 0 ? Math.round((totalCollected / totalNetFee) * 100) : 0

  return {
    totalStudents,
    pendingOffers,
    overdueInstallments,
    overdueAmount,
    overdueCount: overdueInstallments.length,
    dueThisMonthCount: dueThisMonthInstallments.length,
    dueThisMonthAmount,
    collectedThisMonth,
    collectionRate,
    totalCollected,
    totalNetFee,
    recentPayments,
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
      eyebrow: "Overdue",
      value: d.overdueCount,
      sub: d.overdueCount > 0 ? `${formatINR(d.overdueAmount)} outstanding` : "All clear",
      icon: AlertTriangle,
      accent: "rose" as const,
      href: "/students?tab=overdue",
    },
    {
      eyebrow: "Due This Month",
      value: d.dueThisMonthCount,
      sub: formatINR(d.dueThisMonthAmount),
      icon: Clock,
      accent: "amber" as const,
      href: "/students",
    },
    {
      eyebrow: "Collected This Month",
      value: formatINR(d.collectedThisMonth),
      sub: null,
      icon: IndianRupee,
      accent: "emerald" as const,
      isAmount: true,
      href: null,
    },
  ]

  const accentStyles = {
    indigo:  { icon: "bg-[#3663AD]/10 text-[#3663AD]",   value: "text-[#3663AD]" },
    violet:  { icon: "bg-[#160E44]/10 text-[#160E44]",   value: "text-[#160E44]" },
    rose:    { icon: "bg-rose-500/10 text-rose-600",      value: "text-rose-600" },
    amber:   { icon: "bg-amber-500/10 text-amber-600",    value: "text-amber-600" },
    emerald: { icon: "bg-emerald-500/10 text-emerald-600",value: "text-emerald-600" },
  }

  const today = new Date()

  return (
    <div className="space-y-8 max-w-[1200px]">
      <div>
        <Eyebrow>Overview</Eyebrow>
        <h1 className="text-3xl font-black text-slate-900 mt-0.5 font-headline tracking-tight">Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Overdue list */}
        <SoftCard className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <Eyebrow>Attention Needed</Eyebrow>
              <h2 className="text-base font-extrabold text-slate-900 mt-0.5 font-headline">Overdue Payments</h2>
            </div>
            {d.overdueCount > 0 && (
              <Link href="/students?tab=overdue" className="text-xs font-bold text-[#3663AD] hover:text-[#160E44] transition-colors">
                View all →
              </Link>
            )}
          </div>
          {d.overdueCount === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm font-semibold text-slate-500">No overdue payments</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {d.overdueInstallments.map((inst) => {
                const daysOverdue = Math.floor(
                  (today.getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <Link
                    key={inst.id}
                    href={`/students/${inst.student.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">{inst.student.name}</p>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                        {inst.label} · {daysOverdue}d overdue
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-rose-600">{formatINR(inst.amount)}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </SoftCard>

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
      </div>
    </div>
  )
}
