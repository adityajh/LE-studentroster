import { prisma } from "./prisma"
import { sendFeeReminder } from "./mail"

// ── Types ────────────────────────────────────────────────────────────────────


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

  // Fetch active settings from DB
  const settings = await prisma.reminderSetting.findMany({
    where: { isActive: true },
  })

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

    for (const setting of settings) {
      // Check if today falls within this reminder window
      const matches =
        setting.type === "DUE_DATE"
          ? isSameDay(today, inst.dueDate)
          : daysUntilDue >= setting.daysOut && daysUntilDue <= setting.daysOut + 1

      if (!matches) continue

      // Already sent this type of reminder for this installment?
      const alreadySent = inst.reminderLogs.some((l) => l.type === setting.type)
      if (alreadySent) { skipped++; continue }

      // Pre-create log to get an ID for the tracking pixel
      const log = await prisma.reminderLog.create({
        data: {
          installmentId: inst.id,
          type:          setting.type as any,
          emailStatus:   "FAILED", // default until successful
        },
      })

      // Send the email
      const result = await sendFeeReminder({
        to:               inst.student.email!,
        studentName:      inst.student.name,
        installmentLabel: inst.label,
        amount:           Number(inst.paidAmount
          ? Number(inst.amount) - Number(inst.paidAmount)
          : inst.amount),
        dueDate:          inst.dueDate,
        reminderType:     setting.type as any,
        paymentInstructions: process.env.REMINDER_PAYMENT_INSTRUCTIONS ?? undefined,
        logId:            log.id,
      })

      // Determine email status
      let emailStatus: "SENT" | "FAILED" = "SENT"
      let errorMessage: string | null = null

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

      // Update log with final status
      await prisma.reminderLog.update({
        where: { id: log.id },
        data: { emailStatus, errorMessage },
      })
    }
  }

  return { checked: installments.length, sent, skipped, failed }
}
