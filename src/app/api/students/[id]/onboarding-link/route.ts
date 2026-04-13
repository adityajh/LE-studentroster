import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { sendOnboardingLinkEmail } from "@/lib/mail"
import { getSetting } from "@/app/actions/settings"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const student = await prisma.student.findUnique({
    where: { id },
    include: { program: true, batch: true },
  })
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

  // Generate a secure token
  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days

  // Upsert: replace any existing token
  await prisma.onboardingToken.upsert({
    where: { studentId: id },
    create: { studentId: id, tokenHash, expiresAt },
    update: { tokenHash, expiresAt, submittedAt: null },
  })

  // Mark student as LINK_SENT
  await prisma.student.update({
    where: { id },
    data: { selfOnboardingStatus: "LINK_SENT" },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://le-student-roster.vercel.app"
  const onboardingUrl = `${appUrl}/onboard/${rawToken}`

  // Optionally email the student
  const sendEmail = (await req.json().catch(() => ({}))).sendEmail !== false

  if (sendEmail && student.email) {
    const selfOnboardingLinkEmailBody = await getSetting("SELF_ONBOARDING_LINK_EMAIL_BODY", "")
    await sendOnboardingLinkEmail({
      to: [student.email],
      studentName: student.name,
      programName: student.program.name,
      onboardingUrl,
      expiresAt,
      bodyText: selfOnboardingLinkEmailBody || undefined,
    })
  }

  return NextResponse.json({ ok: true, onboardingUrl })
}
