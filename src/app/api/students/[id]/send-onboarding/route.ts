import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { sendOnboardingEmail } from "@/lib/mail"
import { getSettings, getSetting } from "@/app/actions/settings"
import fs from "fs"
import path from "path"

const DEFAULT_ONBOARDING_BODY = `Hi {{studentName}},

You're officially in! Welcome to {{programName}} at Let's Enterprise.

We've bundled everything you need to get started on your journey below.

What You Should Do Now:
1. Read the Onboarding Handbook and Welcome Kit
2. Go through the Fee Structure document to understand timelines and benefits

Once this is done, our team will guide you through the remaining onboarding steps.

We are seriously pumped to have you with us.

Let's give it 100,
The Let's Enterprise Team`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      program: true,
      batch: true,
      financial: true,
      offers: { include: { offer: true } },
      scholarships: { include: { scholarship: true } },
      deductions: true,
      installments: { orderBy: { dueDate: "asc" } },
    },
  })

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })
  if (student.status !== "ACTIVE") return NextResponse.json({ error: "Student must be ACTIVE to send onboarding email" }, { status: 400 })
  if (!student.email) return NextResponse.json({ error: "Student has no email address" }, { status: 400 })

  const settings = await getSettings([
    "ONBOARDING_EMAIL_BODY",
    "ONBOARDING_HANDBOOK_URL",
    "ONBOARDING_WELCOME_KIT_URL",
    "ONBOARDING_YEAR1_URL",
    "PROPOSAL_TERMS",
  ])

  // Load logo
  let logoSrc: string | undefined
  try {
    const logoBuf = fs.readFileSync(path.join(process.cwd(), "public", "le-logo-dark.png"))
    logoSrc = `data:image/png;base64,${logoBuf.toString("base64")}`
  } catch { /* logo missing — PDF falls back to text */ }

  const { ProposalDocument } = await import("@/lib/pdf-generator")
  const terms = student.financial?.customTerms
    || await getSetting("PROPOSAL_TERMS", "All fees must be paid on or before the due date.")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposalBuffer = await renderToBuffer(createElement(ProposalDocument, { student, terms, logoSrc }) as any)

  const recipients = [student.email]
  if (student.parent1Email) recipients.push(student.parent1Email)

  const result = await sendOnboardingEmail({
    to: recipients,
    studentName: student.name,
    programName: student.program.name,
    bodyText: (settings["ONBOARDING_EMAIL_BODY"] || DEFAULT_ONBOARDING_BODY)
      .replace(/\{\{studentName\}\}/g, student.name)
      .replace(/\{\{programName\}\}/g, student.program.name),
    handbookUrl: settings["ONBOARDING_HANDBOOK_URL"] || undefined,
    welcomeKitUrl: settings["ONBOARDING_WELCOME_KIT_URL"] || undefined,
    year1Url: settings["ONBOARDING_YEAR1_URL"] || undefined,
    proposalPdf: Buffer.from(proposalBuffer),
  })

  if (!result.ok) {
    const errMsg = "error" in result ? result.error : ("reason" in result ? result.reason : "Failed to send")
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

  await prisma.student.update({
    where: { id },
    data: { onboardingEmailSentAt: new Date() },
  })

  return NextResponse.json({ ok: true, messageId: result.messageId, sentTo: recipients })
}
