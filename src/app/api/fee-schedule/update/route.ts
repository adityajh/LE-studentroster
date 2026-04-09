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

  const { feeScheduleId, programs, offers, scholarships, deletedOfferIds = [], deletedScholarshipIds = [] } = await req.json()

  // Check schedule isn't locked
  const schedule = await prisma.feeSchedule.findUnique({
    where: { id: feeScheduleId },
    select: { isLocked: true },
  })
  if (schedule?.isLocked) {
    return NextResponse.json({ error: "Fee schedule is locked" }, { status: 400 })
  }

  // Update all in a transaction
  await prisma.$transaction(async (tx) => {
    // Update programs
    for (const p of programs) {
      const totalFee =
        parseFloat(p.registrationFee) +
        parseFloat(p.year1Fee) +
        parseFloat(p.year2Fee) +
        parseFloat(p.year3Fee)
      await tx.program.update({
        where: { id: p.id },
        data: {
          registrationFee: parseFloat(p.registrationFee),
          year1Fee: parseFloat(p.year1Fee),
          year2Fee: parseFloat(p.year2Fee),
          year3Fee: parseFloat(p.year3Fee),
          totalFee,
          targetStudents: p.targetStudents ? parseInt(p.targetStudents) : null,
        },
      })
    }

    // Delete removed items
    if (deletedOfferIds.length > 0) {
      await tx.offer.deleteMany({ where: { id: { in: deletedOfferIds } } })
    }
    if (deletedScholarshipIds.length > 0) {
      await tx.scholarship.deleteMany({ where: { id: { in: deletedScholarshipIds } } })
    }

    // Upsert offers
    for (const o of offers) {
      if (o.id.startsWith("new-")) {
        await tx.offer.create({
          data: {
            feeScheduleId,
            type: o.type,
            name: o.name,
            waiverAmount: parseFloat(o.waiverAmount || "0"),
            deadline: o.deadline ? new Date(o.deadline) : null,
          },
        })
      } else {
        await tx.offer.update({
          where: { id: o.id },
          data: {
            name: o.name,
            waiverAmount: parseFloat(o.waiverAmount || "0"),
            deadline: o.deadline ? new Date(o.deadline) : null,
          },
        })
      }
    }

    // Upsert scholarships
    for (const s of scholarships) {
      if (s.id.startsWith("new-")) {
        await tx.scholarship.create({
          data: {
            feeScheduleId,
            category: s.category,
            name: s.name,
            minAmount: parseFloat(s.minAmount || "0"),
            maxAmount: parseFloat(s.maxAmount || "0"),
          },
        })
      } else {
        await tx.scholarship.update({
          where: { id: s.id },
          data: {
            name: s.name,
            minAmount: parseFloat(s.minAmount || "0"),
            maxAmount: parseFloat(s.maxAmount || "0"),
          },
        })
      }
    }
  })

  return NextResponse.json({ success: true })
}
