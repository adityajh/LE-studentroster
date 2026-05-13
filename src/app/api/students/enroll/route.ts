import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { generateRollNo } from "@/lib/students"
import { splitWaivers } from "@/lib/fee-calc"
import { saveFeeLetterVersion } from "@/lib/fee-letter"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import fs from "fs"
import path from "path"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const {
    firstName,
    lastName,
    name,
    email,
    contact,
    bloodGroup,
    city,
    address,
    localAddress,
    parent1Name, parent1Email, parent1Phone,
    parent2Name, parent2Email, parent2Phone,
    localGuardianName, localGuardianPhone, localGuardianEmail,
    batchId,
    programId,
    offerIds,           // string[]
    scholarships,       // [{ scholarshipId, amount }]
    deductions,         // [{ description, amount }]
    installmentType,    // "ANNUAL" | "ONE_TIME" | "CUSTOM"
    customInstallments, // [{ label, dueDate, amount, year }] — only when CUSTOM
    customTerms,        // string
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

  // Load scholarship records to check spreadAcrossYears
  const scholarshipIds = selectedScholarships.map(s => s.scholarshipId)
  const scholarshipRecords = scholarshipIds.length
    ? await prisma.scholarship.findMany({ where: { id: { in: scholarshipIds } } })
    : []

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
  const totalDeduction = (deductions ?? []).reduce(
    (sum: number, d: { amount: number }) => sum + d.amount,
    0
  )
  const totalWaiver = totalOfferWaiver + totalScholarshipWaiver
  const netFee = baseFee - totalWaiver - totalDeduction

  const year1 = program.year1Fee.toNumber()
  const year2 = program.year2Fee.toNumber()
  const year3 = program.year3Fee.toNumber()
  const regFee = program.registrationFee.toNumber()

  const { spreadY1, spreadY2, spreadY3, onetimeTotal: onetimeWaiver } = splitWaivers(
    selectedOffers.map(o => ({ conditions: o.conditions, waiverAmount: Number(o.waiverAmount) })),
    selectedScholarships.map(s => ({
      amount: s.amount,
      spreadAcrossYears: scholarshipRecords.find(r => r.id === s.scholarshipId)?.spreadAcrossYears ?? true,
    }))
  )

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

  // Use per-program due dates from yearWiseDetails if set, else batch-year defaults
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

  if (installmentType === "CUSTOM") {
    // Use client-supplied schedule directly
    for (const inst of (customInstallments as { label: string; dueDate: string; amount: number; year: number }[])) {
      const due = new Date(inst.dueDate)
      installments.push({
        year: inst.year,
        label: inst.label,
        dueDate: due,
        amount: inst.amount,
        status: due <= today ? "DUE" : "UPCOMING",
      })
    }
  } else {
    // Registration is always first
    installments.push({
      year: 0,
      label: "Registration Fee",
      dueDate: today,
      amount: regFee,
      status: "DUE",
    })

    if (installmentType === "ANNUAL") {
      installments.push(
        {
          year: 1,
          label: "Year 1 — Growth",
          dueDate: year1Due,
          amount: Math.max(0, Math.round(year1 - spreadY1 - onetimeWaiver)),
          status: year1Due <= today ? "DUE" : "UPCOMING",
        },
        {
          year: 2,
          label: "Year 2 — Projects",
          dueDate: year2Due,
          amount: Math.max(0, Math.round(year2 - spreadY2)),
          status: "UPCOMING",
        },
        {
          year: 3,
          label: "Year 3 — Work",
          dueDate: year3Due,
          amount: Math.max(0, Math.round(year3 - spreadY3)),
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
  }

  // Create everything in a transaction
  const student = await prisma.$transaction(async (tx) => {
    const s = await tx.student.create({
      data: {
        rollNo,
        name,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        email,
        contact,
        bloodGroup: bloodGroup ?? null,
        city: city ?? null,
        address: address ?? null,
        localAddress: localAddress ?? null,
        parent1Name: parent1Name ?? null,
        parent1Email: parent1Email ?? null,
        parent1Phone: parent1Phone ?? null,
        parent2Name: parent2Name ?? null,
        parent2Email: parent2Email ?? null,
        parent2Phone: parent2Phone ?? null,
        localGuardianName: localGuardianName ?? null,
        localGuardianPhone: localGuardianPhone ?? null,
        localGuardianEmail: localGuardianEmail ?? null,
        batchId,
        programId,
        status: "ACTIVE" as const,  // direct-enrol path always creates ACTIVE students
      },
    })

    await tx.studentFinancial.create({
      data: {
        studentId: s.id,
        baseFee,
        totalWaiver,
        totalDeduction,
        netFee,
        installmentType,
        customTerms: customTerms ?? null,
        isLocked: true,
        lockedAt: new Date(),
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
          amount: sc.amount,
        })),
      })
    }

    if ((deductions ?? []).length > 0) {
      await tx.studentDeduction.createMany({
        data: (deductions as { description: string; amount: number }[]).map((d) => ({
          studentId: s.id,
          description: d.description,
          amount: d.amount,
        })),
      })
    }

    await tx.installment.createMany({
      data: installments.map((inst) => ({
        studentId: s.id,
        year: inst.year,
        label: inst.label,
        dueDate: inst.dueDate,
        amount: inst.amount,
        status: inst.status,
      })),
    })

    return s
  })

  // Generate and save fee letter for directly enrolled students
  try {
    const studentFull = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        program: true,
        batch: true,
        financial: true,
        installments: { orderBy: { dueDate: "asc" } },
        offers: { include: { offer: true } },
        scholarships: { include: { scholarship: true } },
        deductions: true,
      },
    })
    if (studentFull) {
      const { ProposalDocument } = await import("@/lib/pdf-generator")
      const { loadPdfAppendixData } = await import("@/lib/pdf-appendix-data")
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user!.email! },
        select: { id: true },
      })
      const appendix = await loadPdfAppendixData({ customTerms: studentFull.financial?.customTerms })
      let logoSrc: string | undefined
      try {
        const logoBuf = fs.readFileSync(path.join(process.cwd(), "public", "le-logo-light.png"))
        logoSrc = `data:image/png;base64,${logoBuf.toString("base64")}`
      } catch { /* logo missing */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfBuffer = await renderToBuffer(createElement(ProposalDocument, { student: studentFull, ...appendix, logoSrc }) as any)
      await saveFeeLetterVersion(student.id, Buffer.from(pdfBuffer), "GENERATED", dbUser?.id)
    }
  } catch (err) {
    console.error("[fee-letter generation]", err)
    // Non-fatal — student is enrolled, letter can be uploaded manually
  }

  return NextResponse.json({ id: student.id, rollNo: student.rollNo })
}
