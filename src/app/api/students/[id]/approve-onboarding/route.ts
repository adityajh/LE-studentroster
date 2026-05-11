import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendOnboardingWelcomeEmail } from "@/lib/welcome-email"

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
    select: { selfOnboardingStatus: true, onboardingEmailSentAt: true },
  })
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

  if (student.selfOnboardingStatus !== "SUBMITTED") {
    return NextResponse.json(
      { error: "Student has not submitted their onboarding form yet" },
      { status: 409 }
    )
  }

  // Flip status first (this is the user-visible action that must succeed)
  await prisma.student.update({
    where: { id },
    data: { selfOnboardingStatus: "APPROVED", status: "ACTIVE" },
  })

  // Auto-fire the Onboarding Welcome Email (O4 in the workflow).
  // Skip if it's already been sent (admin previously fired it via the wizard).
  // Email failures don't roll back the approval — they're surfaced separately.
  let welcomeResult: { ok: true; sentTo: string[] } | { ok: false; error: string } | { skipped: true; reason: string } =
    { skipped: true, reason: "already sent" }

  if (!student.onboardingEmailSentAt) {
    const r = await sendOnboardingWelcomeEmail(id)
    if (r.ok) {
      await prisma.student.update({
        where: { id },
        data: { onboardingEmailSentAt: new Date() },
      })
      welcomeResult = { ok: true, sentTo: r.sentTo }
    } else {
      welcomeResult = { ok: false, error: r.error }
    }
  }

  return NextResponse.json({ ok: true, welcomeEmail: welcomeResult })
}
