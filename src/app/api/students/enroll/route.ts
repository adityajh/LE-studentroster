import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { generateRollNo } from "@/lib/students"
import { Decimal } from "@prisma/client/runtime/library"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const {
    name,
    email,
    contact,
    batchId,
    programId,
    offerIds,           // string[]
    scholarships,       // [{ scholarshipId, amount }]
    deductions,         // [{ description, amount }]
    installmentType,    // "ANNUAL" | "ONE_TIME"
  } = body

  if (!name || !email || !contact || !batchId || !programId || !installmentType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Load program and batch
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { batch: true },
  })
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 })
  }

  // Load selected offers
  const selectedOffers = offerIds?.length
    ? await prisma.offer.findMany({ where: { id: { in: offerIds } } })
    : []

  // Load selected scholarships
  const selectedScholarships: { scholarshipId: string; amount: number }[] = scholarships ?? []

  // Fee calculation
  const baseFee = program.totalFee.toNumber()
  const totalOfferWaiver = selectedOffers.reduce(
    (sum, o) => sum + o.waiverAmount.toNumber(),
    0
  )
  const totalScholarshipWaiver = selectedScholarships.reduce(
    (sum, s) => sum + s.amount,
    0
  )
  const totalDeductionAmount = (deductions ?? []).reduce(
    (sum: number, d: { amount: number }) => sum + d.amount,
    0
  )
  const totalWaiver = totalOfferWaiver + totalScholarshipWaiver
  const totalDeduction = totalDeductionAmount
  const netFee = baseFee - totalWaiver - totalDeduction

  const year1 = program.year1Fee.toNumber()
  const year2 = program.year2Fee.toNumber()
  const year3 = program.year3Fee.toNumber()
  const regFee = program.registrationFee.toNumber()
  const waiverPerYear = totalWaiver / 3

  // Generate roll number
  const rollNo = await generateRollNo(program.batch.year)

  // Build installments
  const batchYear = program.batch.year
  const today = new Date()

  const installments: {
    year: number
    label: string
    dueDate: Date
    amount: number
    status: "DUE" | "UPCOMING"
  }[] = []

  // Registration is always first
  installments.push({
    year: 0,
    label: "Registration Fee",
    dueDate: today,
    amount: regFee,
    status: "DUE",
  })

  if (installmentType === "ANNUAL") {
    const year1Due = new Date(`${batchYear}-07-01`)
    const year2Due = new Date(`${batchYear + 1}-07-01`)
    const year3Due = new Date(`${batchYear + 2}-07-01`)
    installments.push(
      {
        year: 1,
        label: "Year 1 — Growth",
        dueDate: year1Due,
        amount: Math.max(0, year1 - waiverPerYear),
        status: year1Due <= today ? "DUE" : "UPCOMING",
      },
      {
        year: 2,
        label: "Year 2 — Projects",
        dueDate: year2Due,
        amount: Math.max(0, year2 - waiverPerYear),
        status: "UPCOMING",
      },
      {
        year: 3,
        label: "Year 3 — Work",
        dueDate: year3Due,
        amount: Math.max(0, year3 - waiverPerYear),
        status: "UPCOMING",
      }
    )
  } else {
    // ONE_TIME: single lump sum for all 3 years
    const fullPaymentDue = new Date(today)
    fullPaymentDue.setDate(fullPaymentDue.getDate() + 30)
    installments.push({
      year: 1,
      label: "Full Programme Fee (3 Years)",
      dueDate: fullPaymentDue,
      amount: Math.max(0, year1 + year2 + year3 - totalWaiver),
      status: "UPCOMING",
    })
  }

  // Create everything in a transaction
  const student = await prisma.$transaction(async (tx) => {
    const s = await tx.student.create({
      data: {
        rollNo,
        name,
        email,
        contact,
        batchId,
        programId,
        status: "ACTIVE",
      },
    })

    await tx.studentFinancial.create({
      data: {
        studentId: s.id,
        baseFee: new Decimal(baseFee),
        totalWaiver: new Decimal(totalWaiver),
        totalDeduction: new Decimal(totalDeduction),
        netFee: new Decimal(netFee),
        installmentType,
      },
    })

    if (selectedOffers.length > 0) {
      await tx.studentOffer.createMany({
        data: selectedOffers.map((o) => ({
          studentId: s.id,
          offerId: o.id,
          waiverAmount: o.waiverAmount,
        })),
      })
    }

    if (selectedScholarships.length > 0) {
      await tx.studentScholarship.createMany({
        data: selectedScholarships.map((sc) => ({
          studentId: s.id,
          scholarshipId: sc.scholarshipId,
          amount: new Decimal(sc.amount),
        })),
      })
    }

    if ((deductions ?? []).length > 0) {
      await tx.studentDeduction.createMany({
        data: (deductions as { description: string; amount: number }[]).map((d) => ({
          studentId: s.id,
          description: d.description,
          amount: new Decimal(d.amount),
        })),
      })
    }

    await tx.installment.createMany({
      data: installments.map((inst) => ({
        studentId: s.id,
        year: inst.year,
        label: inst.label,
        dueDate: inst.dueDate,
        amount: new Decimal(inst.amount),
        status: inst.status,
      })),
    })

    return s
  })

  return NextResponse.json({ id: student.id, rollNo: student.rollNo })
}
