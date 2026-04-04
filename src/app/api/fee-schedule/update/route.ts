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

  const { feeScheduleId, programs, offers, scholarships } = await req.json()

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

    // Update offers
    for (const o of offers) {
      await tx.offer.update({
        where: { id: o.id },
        data: {
          name: o.name,
          waiverAmount: parseFloat(o.waiverAmount),
          deadline: o.deadline ? new Date(o.deadline) : null,
        },
      })
    }

    // Update scholarships
    for (const s of scholarships) {
      await tx.scholarship.update({
        where: { id: s.id },
        data: {
          name: s.name,
          minAmount: parseFloat(s.minAmount),
          maxAmount: parseFloat(s.maxAmount),
        },
      })
    }
  })

  return NextResponse.json({ success: true })
}
