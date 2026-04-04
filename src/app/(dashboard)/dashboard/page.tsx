import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, AlertTriangle, Clock, CheckCircle } from "lucide-react"

async function getDashboardStats() {
  const [
    totalStudents,
    overdueCount,
    dueThisMonth,
    paidThisMonth,
  ] = await Promise.all([
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
      title: "Active Students",
      value: stats.totalStudents,
      icon: Users,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      description: "Currently enrolled",
    },
    {
      title: "Overdue Payments",
      value: stats.overdueCount,
      icon: AlertTriangle,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      description: "Require follow-up",
    },
    {
      title: "Due This Month",
      value: stats.dueThisMonth,
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      description: "Upcoming installments",
    },
    {
      title: "Paid This Month",
      value: stats.paidThisMonth,
      icon: CheckCircle,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
      description: "Payments received",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of student enrollment and fee payments
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${card.iconBg}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Overdue Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.overdueCount === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">No overdue payments</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {stats.overdueCount} installment(s) overdue. Go to{" "}
                <a href="/students" className="text-blue-600 hover:underline">
                  Students
                </a>{" "}
                to view details.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Upcoming This Month</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.dueThisMonth === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No installments due this month</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {stats.dueThisMonth} installment(s) due this month. Go to{" "}
                <a href="/students" className="text-blue-600 hover:underline">
                  Students
                </a>{" "}
                to send reminders.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
