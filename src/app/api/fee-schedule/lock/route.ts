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
    select: { role: true, id: true },
  })

  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — Admin only" }, { status: 403 })
  }

  const { feeScheduleId, lock } = await req.json()

  if (!feeScheduleId || typeof lock !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const updated = await prisma.feeSchedule.update({
    where: { id: feeScheduleId },
    data: {
      isLocked: lock,
      lockedAt: lock ? new Date() : null,
      lockedById: lock ? dbUser.id : null,
    },
  })

  return NextResponse.json({ success: true, isLocked: updated.isLocked })
}
