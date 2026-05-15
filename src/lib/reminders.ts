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

  // Fetch active students with installments in our window, plus ALL their
  // installments + payments so we can compute FIFO per student.
  const students = await prisma.student.findMany({
    where: {
      status: "ACTIVE",
      email: { not: null },
      installments: {
        some: {
          status: { in: ["UPCOMING", "DUE", "OVERDUE", "PARTIAL"] },
          dueDate: { lte: maxLookahead },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      parent1Email: true,
      payments: { select: { amount: true } },
      financial: { select: { registrationPaid: true, registrationFeeOverride: true } },
      program: { select: { registrationFee: true } },
      installments: {
        include: { reminderLogs: { select: { type: true } } },
        orderBy: { year: "asc" },
      },
    },
  })

  // Flatten to (student, installment) tuples with FIFO-computed pending
  type Tuple = {
    student: (typeof students)[number]
    inst: (typeof students)[number]["installments"][number]
    pending: number
  }
  const tuples: Tuple[] = []
  for (const student of students) {
    const totalPaid = student.payments.reduce((s, p) => s + Number(p.amount), 0)

    // Registration is sometimes its own year=0 installment, sometimes just a
    // flag on `financial.registrationPaid`. When it's the flag form, consume
    // the reg fee out of total payments BEFORE FIFO-allocating to year
    // installments — so the schedule view and reminder amounts agree.
    const hasRegInstallment = student.installments.some((i) => i.year === 0)
    let remaining = totalPaid
    if (!hasRegInstallment && student.financial?.registrationPaid) {
      const regFee = student.financial.registrationFeeOverride != null
        ? Number(student.financial.registrationFeeOverride)
        : Number(student.program?.registrationFee ?? 0)
      remaining = Math.max(0, remaining - regFee)
    }

    for (const inst of student.installments) {
      const fee = Number(inst.amount)
      const received = Math.min(remaining, fee)
      remaining -= received
      const pending = Math.max(0, fee - received)
      // Only consider installments that are (a) within the lookahead window
      // and (b) not already FIFO-cleared. Skip PAID installments too.
      if (inst.dueDate > maxLookahead) continue
      if (inst.status === "PAID") continue
      if (pending === 0) continue
      tuples.push({ student, inst, pending })
    }
  }

  let sent = 0, skipped = 0, failed = 0

  for (const { student, inst, pending } of tuples) {
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

      // Send the email — student + parent1
      const recipients = [student.email, student.parent1Email].filter((e): e is string => !!e)
      const result = await sendFeeReminder({
        to:               recipients,
        studentName:      student.name,
        installmentLabel: inst.label,
        amount:           pending,
        dueDate:          inst.dueDate,
        reminderType:     setting.type as any,
        bodyText:         setting.bodyText,
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

  const stats = { checked: tuples.length, sent, skipped, failed }

  // Persist last-run stats for the Settings UI
  await prisma.systemSetting.upsert({
    where: { key: "CRON_LAST_RUN_FEE_REMINDERS" },
    update: { value: JSON.stringify({ ...stats, runAt: new Date().toISOString() }) },
    create: { key: "CRON_LAST_RUN_FEE_REMINDERS", value: JSON.stringify({ ...stats, runAt: new Date().toISOString() }), updatedBy: "system" },
  })

  return stats
}
