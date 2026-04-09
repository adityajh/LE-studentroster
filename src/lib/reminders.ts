import { prisma } from "./prisma"
import { sendFeeReminder } from "./mail"

// ── Types ────────────────────────────────────────────────────────────────────

type ReminderWindow = {
  type: "ONE_MONTH" | "ONE_WEEK" | "DUE_DATE"
  daysOut: number
}

const WINDOWS: ReminderWindow[] = [
  { type: "ONE_MONTH", daysOut: 30 },
  { type: "ONE_WEEK",  daysOut: 7  },
  { type: "DUE_DATE",  daysOut: 0  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth()    === b.getUTCMonth()    &&
    a.getUTCDate()     === b.getUTCDate()
  )
}

function daysDiff(from: Date, to: Date) {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((to.getTime() - from.getTime()) / msPerDay)
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function processDailyReminders(): Promise<{
  checked: number
  sent: number
  skipped: number
  failed: number
}> {
  const today = new Date()
  const maxLookahead = new Date(today)
  maxLookahead.setDate(maxLookahead.getDate() + 31) // look up to 31 days out

  // Fetch all non-paid installments with an email address, within our window
  const installments = await prisma.installment.findMany({
    where: {
      status: { in: ["UPCOMING", "DUE", "PARTIAL"] },
      dueDate: { lte: maxLookahead },
      student: {
        email: { not: null },
        status: "ACTIVE",
      },
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
      reminderLogs: { select: { type: true } },
    },
    orderBy: { dueDate: "asc" },
  })

  let sent = 0, skipped = 0, failed = 0

  for (const inst of installments) {
    const daysUntilDue = daysDiff(today, inst.dueDate)

    for (const window of WINDOWS) {
      // Check if today falls within this reminder window
      const matches =
        window.type === "DUE_DATE"
          ? isSameDay(today, inst.dueDate)
          : daysUntilDue >= window.daysOut && daysUntilDue <= window.daysOut + 1

      if (!matches) continue

      // Already sent this type of reminder for this installment?
      const alreadySent = inst.reminderLogs.some((l) => l.type === window.type)
      if (alreadySent) { skipped++; continue }

      // Send the email
      const result = await sendFeeReminder({
        to:               inst.student.email!,
        studentName:      inst.student.name,
        installmentLabel: inst.label,
        amount:           Number(inst.paidAmount
          ? Number(inst.amount) - Number(inst.paidAmount)
          : inst.amount),
        dueDate:          inst.dueDate,
        reminderType:     window.type,
        paymentInstructions: process.env.REMINDER_PAYMENT_INSTRUCTIONS ?? undefined,
      })

      // Determine email status
      let emailStatus: "SENT" | "FAILED" = "SENT"
      let errorMessage: string | undefined

      if ("skipped" in result) {
        // Not configured yet — log as FAILED with note but don't count as hard fail
        emailStatus = "FAILED"
        errorMessage = result.reason
        skipped++
      } else if (!result.ok) {
        emailStatus = "FAILED"
        errorMessage = "error" in result ? result.error : "Unknown error"
        failed++
      } else {
        sent++
      }

      // Always log the attempt
      await prisma.reminderLog.create({
        data: {
          installmentId: inst.id,
          type:          window.type,
          emailStatus,
          errorMessage:  errorMessage ?? null,
        },
      })
    }
  }

  return { checked: installments.length, sent, skipped, failed }
}
