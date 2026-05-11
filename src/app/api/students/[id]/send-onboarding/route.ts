import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendOnboardingWelcomeEmail } from "@/lib/welcome-email"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const student = await prisma.student.findUnique({
    where: { id },
    select: { status: true, email: true },
  })
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })
  if (!["ACTIVE", "ONBOARDING"].includes(student.status)) {
    return NextResponse.json({ error: "Student must be in ONBOARDING or ACTIVE status to send onboarding email" }, { status: 400 })
  }

  const result = await sendOnboardingWelcomeEmail(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  await prisma.student.update({
    where: { id },
    data: { onboardingEmailSentAt: new Date() },
  })

  return NextResponse.json({ ok: true, messageId: result.messageId, sentTo: result.sentTo })
}
