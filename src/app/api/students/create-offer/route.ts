import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const {
    firstName,
    lastName,
    name,
    email,
    contact,
    city,
    batchId,
    programId,
    offerIds,       // string[]
    scholarships,   // [{ scholarshipId, amount }]
    customTerms,
    feeY1,          // optional per-year overrides
    feeY2,
    feeY3,
    registrationFee, // optional registration fee override
  } = body

  if (!name || !email || !contact || !batchId || !programId) {
    return NextResponse.json({ error: "name, email, contact, batchId, programId are required" }, { status: 400 })
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { batch: true },
  })
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 })

  const selectedOffers = offerIds?.length
    ? await prisma.offer.findMany({ where: { id: { in: offerIds } } })
    : []

  const selectedScholarships: { scholarshipId: string; amount: number }[] = scholarships ?? []

  // Fee calculation — use per-year overrides if provided, else programme defaults
  const y1 = feeY1 != null ? Number(feeY1) : Number(program.year1Fee)
  const y2 = feeY2 != null ? Number(feeY2) : Number(program.year2Fee)
  const y3 = feeY3 != null ? Number(feeY3) : Number(program.year3Fee)
  const baseFee = y1 + y2 + y3
  const offerWaiver = selectedOffers.reduce((s, o) => s + Number(o.waiverAmount), 0)
  const scholarshipWaiver = selectedScholarships.reduce((s, sc) => s + sc.amount, 0)
  const totalWaiver = offerWaiver + scholarshipWaiver
  const netFee = baseFee - totalWaiver

  const student = await prisma.$transaction(async (tx) => {
    const s = await tx.student.create({
      data: {
        rollNo: null,           // assigned at enrolment confirmation
        name,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        email,
        contact,
        city: city ?? null,
        batchId,
        programId,
        status: "OFFERED",
        enrollmentDate: new Date(),
      },
    })

    await tx.studentFinancial.create({
      data: {
        studentId: s.id,
        baseFee,
        totalWaiver,
        totalDeduction: 0,
        netFee,
        installmentType: "ANNUAL", // placeholder — confirmed at enrolment
        customTerms: customTerms ?? null,
        registrationFeeOverride: registrationFee != null ? Number(registrationFee) : null,
        isLocked: false,        // locked when enrolment is confirmed
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

    return s
  })

  return NextResponse.json({ id: student.id })
}
