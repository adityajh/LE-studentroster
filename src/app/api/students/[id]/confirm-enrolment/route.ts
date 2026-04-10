import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { generateRollNo } from "@/lib/students"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { sendOnboardingEmail } from "@/lib/mail"
import { getSettings, getSetting } from "@/app/actions/settings"

const DEFAULT_ONBOARDING_BODY = `Hi {{studentName}},

You're officially in! Welcome to {{programName}} at Let's Enterprise.

We've bundled everything you need to get started on your journey below.

What You Should Do Now:
1. Read the Onboarding Handbook and Welcome Kit
2. Go through the Fee Structure document to understand timelines and benefits

Once this is done, our team will guide you through the remaining onboarding steps.

We are seriously pumped to have you with us.

Let's give it 100,
The Let's Enterprise Team`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const {
    amount,          // should be 50000
    date,            // ISO string
    paymentMode,     // "CASH" | "CHEQUE" | "NEFT" | "UPI" | "RTGS" | "OTHER"
    referenceNo,
    payerName,
    notes,
    sendOnboarding = true,
  } = body

  if (!amount || !date || !paymentMode) {
    return NextResponse.json({ error: "amount, date, and paymentMode are required" }, { status: 400 })
  }

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      program: { include: { batch: true } },
      batch: true,
      financial: true,
      offers: { include: { offer: true } },
      scholarships: { include: { scholarship: true } },
      deductions: true,
    },
  })

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })
  if (student.status !== "OFFERED") {
    return NextResponse.json({ error: "Student is not in OFFERED status" }, { status: 400 })
  }
  if (!student.financial) {
    return NextResponse.json({ error: "Student has no financial record" }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })

  const program = student.program
  const batchYear = student.batch.year
  const financial = student.financial
  const today = new Date(date)

  // Build installment schedule (same logic as enroll route)
  const year1 = Number(program.year1Fee)
  const year2 = Number(program.year2Fee)
  const year3 = Number(program.year3Fee)
  const regFee = Number(program.registrationFee)
  const totalWaiver = Number(financial.totalWaiver)
  const waiverPerYear = totalWaiver / 3
  const installmentType = financial.installmentType

  const installments: {
    year: number; label: string; dueDate: Date; amount: number; status: "DUE" | "UPCOMING"
  }[] = []

  // Use actual due dates from the program's yearWiseDetails if available
  const yearWise = program.yearWiseDetails as Record<string, { dueDate?: string }> | null

  const year1Due = yearWise?.year1?.dueDate
    ? new Date(yearWise.year1.dueDate)
    : new Date(`${batchYear}-08-07`)
  const year2Due = yearWise?.year2?.dueDate
    ? new Date(yearWise.year2.dueDate)
    : new Date(`${batchYear + 1}-05-15`)
  const year3Due = yearWise?.year3?.dueDate
    ? new Date(yearWise.year3.dueDate)
    : new Date(`${batchYear + 2}-05-15`)

  if (installmentType === "ANNUAL") {
    installments.push(
      { year: 1, label: "Year 1 — Growth", dueDate: year1Due, amount: Math.max(0, year1 - waiverPerYear), status: year1Due <= today ? "DUE" : "UPCOMING" },
      { year: 2, label: "Year 2 — Projects", dueDate: year2Due, amount: Math.max(0, year2 - waiverPerYear), status: "UPCOMING" },
      { year: 3, label: "Year 3 — Work", dueDate: year3Due, amount: Math.max(0, year3 - waiverPerYear), status: "UPCOMING" },
    )
  } else if (installmentType === "ONE_TIME") {
    const fullDue = new Date(today)
    fullDue.setDate(fullDue.getDate() + 30)
    installments.push({
      year: 1,
      label: "Full Programme Fee (3 Years)",
      dueDate: fullDue,
      amount: Math.max(0, year1 + year2 + year3 - totalWaiver),
      status: "UPCOMING",
    })
  }
  // CUSTOM: installments are already created for CUSTOM at offer time (if any) — skip

  const rollNo = await generateRollNo(batchYear)

  // Everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Assign roll number, set status ACTIVE, lock financials
    await tx.student.update({
      where: { id },
      data: {
        rollNo,
        status: "ACTIVE",
        enrollmentDate: today,
      },
    })

    // 2. Mark registration paid
    await tx.studentFinancial.update({
      where: { studentId: id },
      data: {
        registrationPaid: true,
        registrationPaidDate: today,
        isLocked: true,
        lockedAt: today,
      },
    })

    // 3. Record the registration payment
    const payment = await tx.payment.create({
      data: {
        studentId: id,
        date: today,
        amount,
        payerName: payerName ?? null,
        paymentMode,
        referenceNo: referenceNo ?? null,
        notes: notes ?? null,
        recordedById: dbUser?.id ?? null,
      },
    })

    // 4. Create the registration installment as PAID
    await tx.installment.create({
      data: {
        studentId: id,
        year: 0,
        label: "Registration Fee",
        dueDate: today,
        amount: regFee,
        status: "PAID",
        paidDate: today,
        paidAmount: amount,
        paymentMethod: paymentMode,
      },
    })

    // 5. Create future installments
    if (installments.length > 0) {
      await tx.installment.createMany({
        data: installments.map((inst) => ({ studentId: id, ...inst })),
      })
    }

    // 6. Audit log
    await tx.studentAuditLog.create({
      data: {
        studentId: id,
        changedBy: dbUser?.id ?? session.user!.email!,
        field: "status",
        oldValue: "OFFERED",
        newValue: "ACTIVE",
        reason: `Enrolment confirmed — ₹${Number(amount).toLocaleString("en-IN")} registration payment received (${paymentMode}${referenceNo ? `, ref: ${referenceNo}` : ""})`,
      },
    })

    return { payment }
  })

  // 7. Optionally send onboarding email
  let onboardingResult: { ok: boolean; error?: string } = { ok: true }
  if (sendOnboarding && student.email) {
    try {
      const settings = await getSettings([
        "ONBOARDING_EMAIL_BODY",
        "ONBOARDING_HANDBOOK_URL",
        "ONBOARDING_WELCOME_KIT_URL",
        "ONBOARDING_YEAR1_URL",
        "PROPOSAL_TERMS",
      ])

      // Re-fetch student with roll number for proposal PDF
      const updatedStudent = await prisma.student.findUnique({
        where: { id },
        include: {
          program: true, batch: true, financial: true,
          offers: { include: { offer: true } },
          scholarships: { include: { scholarship: true } },
          deductions: true,
          installments: { orderBy: { dueDate: "asc" } },
        },
      })

      if (updatedStudent) {
        const { ProposalDocument } = await import("@/lib/pdf-generator")
        const terms = updatedStudent.financial?.customTerms || settings["PROPOSAL_TERMS"] || "All fees must be paid on or before the due date."
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proposalBuffer = await renderToBuffer(createElement(ProposalDocument, { student: updatedStudent, terms }) as any)

        const recipients = [student.email!]
        if (student.parent1Email) recipients.push(student.parent1Email)

        onboardingResult = await sendOnboardingEmail({
          to: recipients,
          studentName: student.name,
          programName: student.program.name,
          bodyText: settings["ONBOARDING_EMAIL_BODY"] || DEFAULT_ONBOARDING_BODY,
          handbookUrl: settings["ONBOARDING_HANDBOOK_URL"] || undefined,
          welcomeKitUrl: settings["ONBOARDING_WELCOME_KIT_URL"] || undefined,
          year1Url: settings["ONBOARDING_YEAR1_URL"] || undefined,
          proposalPdf: Buffer.from(proposalBuffer),
        })

        if (onboardingResult.ok) {
          await prisma.student.update({
            where: { id },
            data: { onboardingEmailSentAt: new Date() },
          })
        }
      }
    } catch (err) {
      onboardingResult = { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  return NextResponse.json({
    ok: true,
    rollNo,
    paymentId: result.payment.id,
    onboardingEmailSent: onboardingResult.ok,
    onboardingError: onboardingResult.ok ? undefined : ("error" in onboardingResult ? onboardingResult.error : undefined),
  })
}
