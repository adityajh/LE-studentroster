/**
 * Renders the fee structure PDF and sends the Onboarding Welcome Email
 * (workflow code O4) for a given student. Used by:
 *   - POST /api/students/[id]/send-onboarding (admin wizard's "Send Welcome Email")
 *   - POST /api/students/[id]/approve-onboarding (auto-fire on admin approve)
 *
 * Returns the mail send result. The caller decides whether to set
 * student.onboardingEmailSentAt on success.
 */
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import fs from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { sendOnboardingEmail, getResourceLinks } from "@/lib/mail"
import { getSettings } from "@/app/actions/settings"

export const DEFAULT_ONBOARDING_BODY = `Hi {{studentName}},

You're officially in! Welcome to {{programName}} at Let's Enterprise.

We've bundled everything you need to get started on your journey below.

What You Should Do Now:
1. Read the Onboarding Handbook and Welcome Kit
2. Go through the Fee Structure document to understand timelines and benefits

Once this is done, our team will guide you through the remaining onboarding steps.

We are seriously pumped to have you with us.

Let's give it 100,
The Let's Enterprise Team`

type WelcomeResult =
  | { ok: true; messageId: string; sentTo: string[] }
  | { ok: false; error: string }

export async function sendOnboardingWelcomeEmail(studentId: string): Promise<WelcomeResult> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
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

  if (!student) return { ok: false, error: "Student not found" }
  if (!student.email) return { ok: false, error: "Student has no email address" }

  const settings = await getSettings(["ONBOARDING_EMAIL_BODY"])
  const resourceLinks = (await getResourceLinks()).map((l) => ({ label: l.label, url: l.url }))

  // Load logo
  let logoSrc: string | undefined
  try {
    const logoBuf = fs.readFileSync(path.join(process.cwd(), "public", "le-logo-light.png"))
    logoSrc = `data:image/png;base64,${logoBuf.toString("base64")}`
  } catch { /* logo missing — PDF falls back to text */ }

  const { ProposalDocument } = await import("@/lib/pdf-generator")
  const { loadPdfAppendixData } = await import("@/lib/pdf-appendix-data")
  const appendix = await loadPdfAppendixData({ customTerms: student.financial?.customTerms })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposalBuffer = await renderToBuffer(createElement(ProposalDocument, { student, ...appendix, logoSrc }) as any)

  const recipients = [student.email]
  if (student.parent1Email) recipients.push(student.parent1Email)

  const result = await sendOnboardingEmail({
    to: recipients,
    studentName: student.name,
    programName: student.program.name,
    bodyText: (settings["ONBOARDING_EMAIL_BODY"] || DEFAULT_ONBOARDING_BODY)
      .replace(/\{\{studentName\}\}/g, student.name)
      .replace(/\{\{programName\}\}/g, student.program.name),
    resourceLinks,
    proposalPdf: Buffer.from(proposalBuffer),
  })

  if (!result.ok) {
    const errMsg = "error" in result ? result.error : ("reason" in result ? result.reason : "Failed to send")
    return { ok: false, error: errMsg }
  }

  return { ok: true, messageId: result.messageId!, sentTo: recipients }
}
