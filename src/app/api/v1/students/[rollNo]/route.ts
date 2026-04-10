import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"

async function validateApiKey(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")
  if (!apiKey) return null
  const keyHash = createHash("sha256").update(apiKey).digest("hex")
  const key = await prisma.apiKey.findUnique({ where: { keyHash } })
  if (!key || !key.isActive) return null
  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
  return key
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ rollNo: string }> }
) {
  const key = await validateApiKey(req)
  if (!key) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 })

  const { rollNo } = await params

  const student = await prisma.student.findFirst({
    where: { rollNo: { equals: rollNo, mode: "insensitive" } },
    include: {
      batch:   { select: { year: true, name: true } },
      program: { select: { name: true, totalFee: true } },
      financial: {
        select: {
          baseFee: true,
          netFee: true,
          totalWaiver: true,
          totalDeduction: true,
          installmentType: true,
          registrationPaid: true,
        },
      },
      installments: {
        select: { label: true, year: true, dueDate: true, amount: true, status: true, paidAmount: true },
        orderBy: { dueDate: "asc" },
      },
      offers: {
        include: { offer: { select: { name: true, type: true } } },
      },
      scholarships: {
        include: { scholarship: { select: { name: true, category: true } } },
      },
    },
  })

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 })
  }

  return NextResponse.json({
    rollNo: student.rollNo,
    name: student.name,
    email: student.email,
    contact: student.contact,
    status: student.status,
    batch: student.batch.year,
    program: student.program.name,
    enrollmentDate: student.enrollmentDate,
    financial: {
      baseFee:        student.financial?.baseFee,
      netFee:         student.financial?.netFee,
      totalWaiver:    student.financial?.totalWaiver,
      totalDeduction: student.financial?.totalDeduction,
      installmentType: student.financial?.installmentType,
    },
    offers: student.offers.map(o => ({
      name:         o.offer.name,
      type:         o.offer.type,
      waiverAmount: o.waiverAmount,
    })),
    scholarships: student.scholarships.map(s => ({
      name:     s.scholarship.name,
      category: s.scholarship.category,
      amount:   s.amount,
    })),
    installments: student.installments.map(i => ({
      label:      i.label,
      year:       i.year,
      dueDate:    i.dueDate,
      amount:     i.amount,
      paidAmount: i.paidAmount,
      status:     i.status,
    })),
  })
}
