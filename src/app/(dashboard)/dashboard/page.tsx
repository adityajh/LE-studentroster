import { prisma } from "@/lib/prisma"
import { Users, AlertTriangle, Clock, CheckCircle } from "lucide-react"

async function getDashboardStats() {
  const [totalStudents, overdueCount, dueThisMonth, paidThisMonth] =
    await Promise.all([
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.installment.count({ where: { status: "OVERDUE" } }),
      prisma.installment.count({
        where: {
          status: { in: ["DUE", "UPCOMING"] },
          dueDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          },
        },
      }),
      prisma.installment.count({
        where: {
          status: "PAID",
          paidDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          },
        },
      }),
    ])
  return { totalStudents, overdueCount, dueThisMonth, paidThisMonth }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  const statCards = [
    {
      eyebrow: "Enrolled Students",
      value: stats.totalStudents,
      description: "Currently active",
      icon: Users,
      accent: "indigo" as const,
    },
    {
      eyebrow: "Overdue Payments",
      value: stats.overdueCount,
      description: "Require follow-up",
      icon: AlertTriangle,
      accent: "rose" as const,
    },
    {
      eyebrow: "Due This Month",
      value: stats.dueThisMonth,
      description: "Upcoming installments",
      icon: Clock,
      accent: "amber" as const,
    },
    {
      eyebrow: "Paid This Month",
      value: stats.paidThisMonth,
      description: "Payments received",
      icon: CheckCircle,
      accent: "emerald" as const,
    },
  ]

  const accentStyles = {
    indigo: {
      icon: "bg-indigo-500/10 text-indigo-600",
      value: "text-indigo-600",
    },
    rose: {
      icon: "bg-rose-500/10 text-rose-600",
      value: "text-rose-600",
    },
    amber: {
      icon: "bg-amber-500/10 text-amber-600",
      value: "text-amber-600",
    },
    emerald: {
      icon: "bg-emerald-500/10 text-emerald-600",
      value: "text-emerald-600",
    },
  }

  return (
    <div className="space-y-8 max-w-[1200px]">
      {/* Page header */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
          Overview
        </p>
        <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
          Dashboard
        </h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const styles = accentStyles[card.accent]
          return (
            <div
              key={card.eyebrow}
              className="bg-white border border-slate-200/50 p-5 rounded-2xl shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                  {card.eyebrow}
                </p>
                <div className={`rounded-xl p-2 ${styles.icon}`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <p className={`text-3xl font-black ${styles.value}`}>
                {card.value}
              </p>
              <p className="text-xs font-medium text-slate-400 mt-1">
                {card.description}
              </p>
            </div>
          )
        })}
      </div>

      {/* Detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200/50 p-6 rounded-2xl shadow-sm">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
            Attention Needed
          </p>
          <h2 className="text-base font-bold text-slate-900 mb-4">
            Overdue Payments
          </h2>
          {stats.overdueCount === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm font-medium">No overdue payments</p>
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-600">
              {stats.overdueCount} installment(s) overdue.{" "}
              <a href="/students" className="text-indigo-600 hover:underline font-semibold">
                View students →
              </a>
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200/50 p-6 rounded-2xl shadow-sm">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
            This Month
          </p>
          <h2 className="text-base font-bold text-slate-900 mb-4">
            Upcoming Installments
          </h2>
          {stats.dueThisMonth === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">Nothing due this month</p>
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-600">
              {stats.dueThisMonth} installment(s) due this month.{" "}
              <a href="/students" className="text-indigo-600 hover:underline font-semibold">
                Send reminders →
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
