import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  })
  if (!dbUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const student = await prisma.student.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

  if (student.status !== "ONBOARDING") {
    return NextResponse.json({ error: "Student is not in ONBOARDING status" }, { status: 409 })
  }

  await prisma.$transaction([
    prisma.student.update({
      where: { id },
      data: { status: "ACTIVE" },
    }),
    prisma.studentAuditLog.create({
      data: {
        studentId: id,
        changedBy: dbUser.id,
        field: "status",
        oldValue: "ONBOARDING",
        newValue: "ACTIVE",
        reason: "Onboarding completed by admin",
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
