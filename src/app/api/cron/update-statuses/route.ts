import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Vercel Cron calls this daily at 03:00 UTC (configured in vercel.json)
// Also callable manually with the CRON_SECRET header.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const gracePeriodDays = 7

  // UPCOMING → DUE: dueDate has passed, still unpaid
  const { count: markedDue } = await prisma.installment.updateMany({
    where: {
      status: "UPCOMING",
      dueDate: { lte: now },
    },
    data: { status: "DUE" },
  })

  // DUE → OVERDUE: past due date + grace period, still unpaid
  const overdueThreshold = new Date(now)
  overdueThreshold.setDate(overdueThreshold.getDate() - gracePeriodDays)

  const { count: markedOverdue } = await prisma.installment.updateMany({
    where: {
      status: "DUE",
      dueDate: { lte: overdueThreshold },
    },
    data: { status: "OVERDUE" },
  })

  // PARTIAL → OVERDUE: partial payments where dueDate is past grace period
  const { count: markedPartialOverdue } = await prisma.installment.updateMany({
    where: {
      status: "PARTIAL",
      dueDate: { lte: overdueThreshold },
    },
    data: { status: "OVERDUE" },
  })

  return NextResponse.json({
    ok: true,
    markedDue,
    markedOverdue: markedOverdue + markedPartialOverdue,
    runAt: now.toISOString(),
  })
}
