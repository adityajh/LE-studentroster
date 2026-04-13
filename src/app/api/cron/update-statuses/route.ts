import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { sendOfferReminderEmail, sendRevisedOfferEmail } from "@/lib/mail"
import { OfferLetterDocument, type OfferLetterData } from "@/lib/offer-letter-generator"
import { getSettings } from "@/app/actions/settings"

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

  // ── 1. Installment status transitions ──────────────────────────────────────
  //
  // PAID and PARTIAL statuses are set exclusively by FIFO write-back in the
  // pay route (src/lib/fifo.ts syncFifoToDb). This cron only manages the
  // time-based transitions: UPCOMING → DUE → OVERDUE.
  // PAID installments are invisible to these queries (WHERE status = "UPCOMING"
  // / "DUE" / "PARTIAL" never matches PAID), so they are never touched here.

  // UPCOMING → DUE: dueDate has passed, still unpaid
  const { count: markedDue } = await prisma.installment.updateMany({
    where: { status: "UPCOMING", dueDate: { lte: now } },
    data: { status: "DUE" },
  })

  // DUE → OVERDUE: past due date + grace period, still unpaid
  const overdueThreshold = new Date(now)
  overdueThreshold.setDate(overdueThreshold.getDate() - gracePeriodDays)

  const { count: markedOverdue } = await prisma.installment.updateMany({
    where: { status: "DUE", dueDate: { lte: overdueThreshold } },
    data: { status: "OVERDUE" },
  })

  // PARTIAL → OVERDUE: partially paid but past grace period
  // (PARTIAL means FIFO has allocated some but not all of the fee)
  const { count: markedPartialOverdue } = await prisma.installment.updateMany({
    where: { status: "PARTIAL", dueDate: { lte: overdueThreshold } },
    data: { status: "OVERDUE" },
  })

  // ── 2. Offer window management ─────────────────────────────────────────────

  // Fetch all OFFERED students whose offer email has been sent
  const offeredStudents = await prisma.student.findMany({
    where: { status: "OFFERED", offerSentAt: { not: null } },
    include: {
      program: true,
      batch: true,
      financial: true,
      offers: { include: { offer: true } },
      scholarships: { include: { scholarship: true } },
    },
  })

  const settings = offeredStudents.length > 0
    ? await getSettings([
        "OFFER_REMINDER_1_BODY",
        "OFFER_REMINDER_2_BODY",
        "OFFER_EMAIL_BODY",
        "OFFER_LETTER_BODY",
        "BANK_DETAILS",
      ])
    : {}

  const DEFAULT_REMINDER_1 = `Hi {{studentName}},

Just a friendly reminder — your offer for {{programName}} at Let's Enterprise expires in {{daysLeft}} days ({{offerExpiryDate}}).

To confirm your admission, please pay the ₹50,000 registration fee and reply to the admissions team.

Warm regards,
The Let's Enterprise Admissions Team`

  const DEFAULT_REMINDER_2 = `Hi {{studentName}},

Your offer for {{programName}} expires tomorrow ({{offerExpiryDate}}).

Please pay the ₹50,000 registration fee today to secure your seat and retain the 7-day confirmation waiver.

Warm regards,
The Let's Enterprise Admissions Team`

  const DEFAULT_BANK_DETAILS = `Storysells Education Pvt. Ltd\nBank: ICICI Bank, Bund Garden Branch, Pune\nAccount No: 000505026869\nIFSC: ICIC0000005`

  let reminder1Sent = 0, reminder2Sent = 0, offerRevoked = 0

  for (const student of offeredStudents) {
    if (!student.email || !student.offerSentAt || !student.offerExpiresAt) continue

    const offerExpiry = new Date(student.offerExpiresAt)
    const daysLeft = Math.ceil((offerExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    const recipients = [student.email, student.parent1Email].filter((e): e is string => !!e)

    // Reminder 1: 3–5 days before expiry (target = 4 days)
    if (daysLeft >= 3 && daysLeft <= 5 && !student.offerReminder1SentAt) {
      const result = await sendOfferReminderEmail({
        to: recipients,
        studentName: student.name,
        programName: student.program.name,
        offerExpiryDate: offerExpiry,
        daysLeft,
        reminderNumber: 1,
        bodyText: settings["OFFER_REMINDER_1_BODY"] || DEFAULT_REMINDER_1,
      })
      if (result.ok) {
        await prisma.student.update({ where: { id: student.id }, data: { offerReminder1SentAt: now } })
        reminder1Sent++
      }
    }

    // Reminder 2: 0–2 days before expiry (target = 1 day)
    if (daysLeft >= 0 && daysLeft <= 2 && !student.offerReminder2SentAt) {
      const result = await sendOfferReminderEmail({
        to: recipients,
        studentName: student.name,
        programName: student.program.name,
        offerExpiryDate: offerExpiry,
        daysLeft,
        reminderNumber: 2,
        bodyText: settings["OFFER_REMINDER_2_BODY"] || DEFAULT_REMINDER_2,
      })
      if (result.ok) {
        await prisma.student.update({ where: { id: student.id }, data: { offerReminder2SentAt: now } })
        reminder2Sent++
      }
    }

    // Day 8+: revoke 7-day offer waiver and send revised offer
    if (daysLeft < 0 && !student.offerRevised) {
      // Remove ACCEPTANCE_7DAY offer from student
      const acceptance7DayOffers = student.offers.filter(
        (so) => so.offer.type === "ACCEPTANCE_7DAY"
      )

      if (acceptance7DayOffers.length > 0) {
        const revokedWaiver = acceptance7DayOffers.reduce((s, so) => s + Number(so.waiverAmount), 0)

        await prisma.$transaction(async (tx) => {
          await tx.studentOffer.deleteMany({
            where: { id: { in: acceptance7DayOffers.map((so) => so.id) } },
          })
          if (student.financial) {
            await tx.studentFinancial.update({
              where: { studentId: student.id },
              data: {
                totalWaiver: { decrement: revokedWaiver },
                netFee: { increment: revokedWaiver },
              },
            })
          }
          await tx.studentAuditLog.create({
            data: {
              studentId: student.id,
              changedBy: student.id, // system action — use student id as placeholder
              field: "offers",
              oldValue: "ACCEPTANCE_7DAY waiver applied",
              newValue: "ACCEPTANCE_7DAY waiver revoked (7-day window expired)",
              reason: "Automated: offer window expired without registration payment",
            },
          })
        })
      }

      // Mark offer as revised
      await prisma.student.update({
        where: { id: student.id },
        data: { offerRevised: true },
      })

      // Send revised offer letter (without 7-day waiver)
      // Re-fetch to get updated financial data
      const updatedStudent = await prisma.student.findUnique({
        where: { id: student.id },
        include: {
          offers: { include: { offer: true } },
          scholarships: { include: { scholarship: true } },
          financial: true,
        },
      })

      if (updatedStudent?.financial) {
        const regFee = updatedStudent.financial.registrationFeeOverride != null
          ? Number(updatedStudent.financial.registrationFeeOverride)
          : Number(student.program.registrationFee)
        const offerLetterData: OfferLetterData = {
          studentName: student.name,
          programName: student.program.name,
          batchYear: student.batch.year,
          offerExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 days
          registrationFee: regFee,
          baseFee: Number(student.financial?.baseFee ?? student.program.totalFee),
          year1Fee: Number(student.program.year1Fee),
          year2Fee: Number(student.program.year2Fee),
          year3Fee: Number(student.program.year3Fee),
          offers: (updatedStudent.offers ?? []).map((o) => ({
            name: o.offer.name,
            amount: Number(o.waiverAmount),
            deadline: o.offer.deadline,
          })),
          scholarships: (updatedStudent.scholarships ?? []).map((sc) => ({ name: sc.scholarship.name, amount: Number(sc.amount) })),
          netFee: Number(updatedStudent.financial.netFee),
          bankDetails: settings["BANK_DETAILS"] || DEFAULT_BANK_DETAILS,
          bodyText: settings["OFFER_LETTER_BODY"] || undefined,
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const offerLetterPdf = await renderToBuffer(createElement(OfferLetterDocument, { data: offerLetterData }) as any)

        await sendRevisedOfferEmail({
          to: [student.email],
          studentName: student.name,
          programName: student.program.name,
          batchYear: student.batch.year,
          offerExpiryDate: offerLetterData.offerExpiresAt,
          bodyText: settings["OFFER_EMAIL_BODY"] || `Hi {{studentName}},\n\nYour 7-day confirmation window has passed, but your seat is still available.\n\nWarm regards,\nThe Let's Enterprise Admissions Team`,
          bankDetails: settings["BANK_DETAILS"] || DEFAULT_BANK_DETAILS,
          offerLetterPdf: Buffer.from(offerLetterPdf),
        })
        offerRevoked++
      }
    }
  }

  const result = {
    markedDue,
    markedOverdue: markedOverdue + markedPartialOverdue,
    offerReminder1Sent: reminder1Sent,
    offerReminder2Sent: reminder2Sent,
    offerWindowRevoked: offerRevoked,
    runAt: now.toISOString(),
  }

  await prisma.systemSetting.upsert({
    where: { key: "CRON_LAST_RUN_UPDATE_STATUSES" },
    update: { value: JSON.stringify(result) },
    create: { key: "CRON_LAST_RUN_UPDATE_STATUSES", value: JSON.stringify(result), updatedBy: "system" },
  })

  return NextResponse.json({ ok: true, ...result })
}
