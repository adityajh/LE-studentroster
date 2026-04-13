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

  // Only admins can approve
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const student = await prisma.student.findUnique({
    where: { id },
    select: { selfOnboardingStatus: true },
  })
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

  if (student.selfOnboardingStatus !== "SUBMITTED") {
    return NextResponse.json(
      { error: "Student has not submitted their onboarding form yet" },
      { status: 409 }
    )
  }

  await prisma.student.update({
    where: { id },
    data: { selfOnboardingStatus: "APPROVED", status: "ACTIVE" },
  })

  return NextResponse.json({ ok: true })
}
