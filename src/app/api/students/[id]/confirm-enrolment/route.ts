import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { generateRollNo } from "@/lib/students"
import { splitWaivers } from "@/lib/fee-calc"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const {
    // Confirmed benefits (may differ from what was offered)
    offerIds,           // string[]
    scholarships,       // [{ scholarshipId, amount }]
    deductions,         // [{ description, amount }]
    // Payment plan
    installmentType,    // "ANNUAL" | "ONE_TIME" | "CUSTOM"
    customInstallments, // [{ label, dueDate, amount, year }] — only for CUSTOM
    // Registration payment
    amount,
    date,
    paymentMode,
    referenceNo,
    payerName,
    notes,
  } = body

  if (!amount || !date || !paymentMode || !installmentType) {
    return NextResponse.json({ error: "amount, date, paymentMode and installmentType are required" }, { status: 400 })
  }

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      program: { include: { batch: true } },
      batch: true,
      financial: true,
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
  const today = new Date(date)

  // ── Load confirmed offers & scholarships ──────────────────────────────────
  const selectedOffers = (offerIds ?? []).length
    ? await prisma.offer.findMany({ where: { id: { in: offerIds } } })
    : []

  // Server-side deadline guard — reject expired offers
  const enrolmentDate = new Date(date)
  enrolmentDate.setHours(23, 59, 59, 999) // use end of enrolment day as cutoff
  const expiredOffers = selectedOffers.filter(
    (o) => o.deadline !== null && new Date(o.deadline) < enrolmentDate
  )
  if (expiredOffers.length > 0) {
    return NextResponse.json(
      { error: `The following offers have expired and cannot be applied: ${expiredOffers.map((o) => o.name).join(", ")}` },
      { status: 400 }
    )
  }

  const selectedScholarships: { scholarshipId: string; amount: number }[] = scholarships ?? []
  const scholarshipIds = selectedScholarships.map((s: { scholarshipId: string }) => s.scholarshipId)
  const scholarshipRecords = scholarshipIds.length
    ? await prisma.scholarship.findMany({ where: { id: { in: scholarshipIds } } })
    : []

  const selectedDeductions: { description: string; amount: number }[] = deductions ?? []

  // ── Recalculate fees from confirmed values ────────────────────────────────
  const baseFee = Number(student.financial.baseFee)  // base was set at offer time (may include overrides)
  const totalOfferWaiver = selectedOffers.reduce((s, o) => s + Number(o.waiverAmount), 0)
  const totalScholarshipWaiver = selectedScholarships.reduce((s: number, sc: { amount: number }) => s + sc.amount, 0)
  const totalDeduction = selectedDeductions.reduce((s, d) => s + d.amount, 0)
  const totalWaiver = totalOfferWaiver + totalScholarshipWaiver
  const netFee = Math.max(0, baseFee - totalWaiver - totalDeduction)

  const regFee = student.financial.registrationFeeOverride != null
    ? Number(student.financial.registrationFeeOverride)
    : Number(program.registrationFee)

  const year1 = Number(program.year1Fee)
  const year2 = Number(program.year2Fee)
  const year3 = Number(program.year3Fee)

  const { spreadPerYear, onetimeTotal: onetimeWaiver } = splitWaivers(
    selectedOffers.map((o) => ({ conditions: o.conditions, waiverAmount: Number(o.waiverAmount) })),
    selectedScholarships.map((s: { scholarshipId: string; amount: number }) => ({
      amount: s.amount,
      spreadAcrossYears: scholarshipRecords.find((r) => r.id === s.scholarshipId)?.spreadAcrossYears ?? true,
    }))
  )

  // ── Build installment schedule ─────────────────────────────────────────────
  const yearWise = program.yearWiseDetails as Record<string, { dueDate?: string }> | null
  const year1Due = yearWise?.year1?.dueDate ? new Date(yearWise.year1.dueDate) : new Date(`${batchYear}-08-07`)
  const year2Due = yearWise?.year2?.dueDate ? new Date(yearWise.year2.dueDate) : new Date(`${batchYear + 1}-05-15`)
  const year3Due = yearWise?.year3?.dueDate ? new Date(yearWise.year3.dueDate) : new Date(`${batchYear + 2}-05-15`)

  const installments: { year: number; label: string; dueDate: Date; amount: number; status: "DUE" | "UPCOMING" }[] = []

  if (installmentType === "CUSTOM") {
    for (const inst of (customInstallments as { label: string; dueDate: string; amount: number; year: number }[])) {
      const due = new Date(inst.dueDate)
      installments.push({ year: inst.year, label: inst.label, dueDate: due, amount: inst.amount, status: due <= today ? "DUE" : "UPCOMING" })
    }
  } else if (installmentType === "ANNUAL") {
    installments.push(
      { year: 1, label: "Year 1 — Growth", dueDate: year1Due, amount: Math.max(0, Math.round(year1 - spreadPerYear - onetimeWaiver - totalDeduction)), status: year1Due <= today ? "DUE" : "UPCOMING" },
      { year: 2, label: "Year 2 — Projects", dueDate: year2Due, amount: Math.max(0, Math.round(year2 - spreadPerYear)), status: "UPCOMING" },
      { year: 3, label: "Year 3 — Work", dueDate: year3Due, amount: Math.max(0, Math.round(year3 - spreadPerYear)), status: "UPCOMING" },
    )
  } else {
    // ONE_TIME
    const fullDue = new Date(today)
    fullDue.setDate(fullDue.getDate() + 30)
    installments.push({ year: 1, label: "Full Programme Fee (3 Years)", dueDate: fullDue, amount: Math.max(0, baseFee - totalWaiver - totalDeduction), status: "UPCOMING" })
  }

  const rollNo = await generateRollNo(batchYear)

  // ── Transaction ───────────────────────────────────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    // 1. Assign roll number, set ONBOARDING
    await tx.student.update({
      where: { id },
      data: { rollNo, status: "ONBOARDING", enrollmentDate: today },
    })

    // 2. Replace offers with confirmed set
    await tx.studentOffer.deleteMany({ where: { studentId: id } })
    if (selectedOffers.length > 0) {
      await tx.studentOffer.createMany({
        data: selectedOffers.map((o) => ({ studentId: id, offerId: o.id, waiverAmount: o.waiverAmount })),
      })
    }

    // 3. Replace scholarships with confirmed set
    await tx.studentScholarship.deleteMany({ where: { studentId: id } })
    if (selectedScholarships.length > 0) {
      await tx.studentScholarship.createMany({
        data: selectedScholarships.map((s: { scholarshipId: string; amount: number }) => ({
          studentId: id, scholarshipId: s.scholarshipId, amount: s.amount,
        })),
      })
    }

    // 4. Replace deductions
    await tx.studentDeduction.deleteMany({ where: { studentId: id } })
    if (selectedDeductions.length > 0) {
      await tx.studentDeduction.createMany({
        data: selectedDeductions.map((d) => ({ studentId: id, description: d.description, amount: d.amount })),
      })
    }

    // 5. Update financial with confirmed values & lock
    await tx.studentFinancial.update({
      where: { studentId: id },
      data: {
        totalWaiver,
        totalDeduction,
        netFee,
        installmentType,
        registrationPaid: true,
        registrationPaidDate: today,
        isLocked: true,
        lockedAt: today,
      },
    })

    // 6. Record registration payment
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

    // 7. Create registration installment as PAID
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

    // 8. Create future installments
    if (installments.length > 0) {
      await tx.installment.createMany({
        data: installments.map((inst) => ({ studentId: id, ...inst })),
      })
    }

    // 9. Audit log
    await tx.studentAuditLog.create({
      data: {
        studentId: id,
        changedBy: dbUser?.id ?? session.user!.email!,
        field: "status",
        oldValue: "OFFERED",
        newValue: "ONBOARDING",
        reason: `Enrolment confirmed — Rs. ${Number(amount).toLocaleString("en-IN")} registration payment received (${paymentMode}${referenceNo ? `, ref: ${referenceNo}` : ""})`,
      },
    })

    return { payment }
  })

  return NextResponse.json({
    ok: true,
    rollNo,
    paymentId: result.payment.id,
  })
}
