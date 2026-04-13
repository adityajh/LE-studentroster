import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })

  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { year, name, programs, offers, scholarships } = await req.json()

  if (!year || !programs?.length) {
    return NextResponse.json({ error: "Year and at least one program are required" }, { status: 400 })
  }

  const batchYear = parseInt(year)
  if (isNaN(batchYear)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 })
  }

  // Check for duplicate year
  const existing = await prisma.batch.findUnique({ where: { year: batchYear } })
  if (existing) {
    return NextResponse.json({ error: `A fee schedule for batch ${batchYear} already exists` }, { status: 409 })
  }

  await prisma.$transaction(async (tx) => {
    // Create batch
    const batch = await tx.batch.create({
      data: {
        year: batchYear,
        name: name || `Batch ${batchYear}`,
      },
    })

    // Create fee schedule
    const feeSchedule = await tx.feeSchedule.create({
      data: { batchId: batch.id },
    })

    // Create programs
    for (const p of programs) {
      const reg = parseFloat(p.registrationFee || "0")
      const y1 = parseFloat(p.year1Fee || "0")
      const y2 = parseFloat(p.year2Fee || "0")
      const y3 = parseFloat(p.year3Fee || "0")
      await tx.program.create({
        data: {
          batchId: batch.id,
          name: p.name,
          registrationFee: reg,
          year1Fee: y1,
          year2Fee: y2,
          year3Fee: y3,
          totalFee: reg + y1 + y2 + y3,
          targetStudents: p.targetStudents ? parseInt(p.targetStudents) : null,
        },
      })
    }

    // Create offers
    for (const o of (offers ?? [])) {
      await tx.offer.create({
        data: {
          feeScheduleId: feeSchedule.id,
          type: o.type || "FULL_PAYMENT",
          name: o.name,
          waiverAmount: parseFloat(o.waiverAmount || "0"),
          deadline: o.deadline ? new Date(o.deadline) : null,
          conditions: { spreadAcrossYears: o.spreadAcrossYears ?? true },
        },
      })
    }

    // Create scholarships
    for (const s of (scholarships ?? [])) {
      await tx.scholarship.create({
        data: {
          feeScheduleId: feeSchedule.id,
          category: s.category,
          name: s.name,
          minAmount: parseFloat(s.minAmount || "0"),
          maxAmount: parseFloat(s.maxAmount || "0"),
        },
      })
    }
  })

  return NextResponse.json({ year: batchYear })
}
