import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { OfferLetterDocument, type OfferLetterData } from "@/lib/offer-letter-generator"
import { sendOfferEmail } from "@/lib/mail"
import { getSettings } from "@/app/actions/settings"
import fs from "fs"
import path from "path"

const DEFAULT_OFFER_EMAIL_BODY = `Hi {{studentName}},

Congratulations!

We are delighted to offer you admission to {{programName}} at Let's Enterprise.

This program is designed for students who are ready to learn by doing, reflect deeply, and grow through real-world exposure.

Step 1: Confirm Your Admission (Within 7 Days)

To secure your seat, please reply to this email confirming acceptance and pay the ₹50,000 registration fee within 7 days using the bank details below.

Seats are held for 7 days and allotted on a rolling basis.

We look forward to welcoming you.

Warm regards,
The Let's Enterprise Admissions Team`

const DEFAULT_BANK_DETAILS = `Storysells Education Pvt. Ltd
Bank: ICICI Bank, Bund Garden Branch, Pune
Account No: 000505026869
IFSC: ICIC0000005`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { includeProposal = false } = body

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
  if (!student.email) return NextResponse.json({ error: "Student has no email address" }, { status: 400 })
  if (student.status !== "OFFERED") return NextResponse.json({ error: "Student is not in OFFERED status" }, { status: 400 })

  const settings = await getSettings([
    "OFFER_EMAIL_BODY",
    "OFFER_LETTER_BODY",
    "BANK_DETAILS",
  ])

  // Load logo as base64
  let logoSrc: string | undefined
  try {
    const logoBuf = fs.readFileSync(path.join(process.cwd(), "public", "le-logo-light.png"))
    logoSrc = `data:image/png;base64,${logoBuf.toString("base64")}`
  } catch {
    // logo missing — PDF will fall back to text
  }

  const offerExpiresAt = student.offerExpiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // Build offer letter PDF data
  const offerLetterData: OfferLetterData = {
    studentName: student.name,
    programName: student.program.name,
    batchYear: student.batch.year,
    offerExpiresAt,
    baseFee: Number(student.financial?.baseFee ?? student.program.totalFee),
    offers: student.offers.map((o) => ({ name: o.offer.name, amount: Number(o.waiverAmount) })),
    scholarships: student.scholarships.map((sc) => ({ name: sc.scholarship.name, amount: Number(sc.amount) })),
    netFee: Number(student.financial?.netFee ?? student.program.totalFee),
    bodyText: settings["OFFER_LETTER_BODY"]
      ? settings["OFFER_LETTER_BODY"]
          .replace(/\{\{studentName\}\}/g, student.name)
          .replace(/\{\{programName\}\}/g, student.program.name)
          .replace(/\{\{batchYear\}\}/g, String(student.batch.year))
          .replace(/\{\{offerExpiryDate\}\}/g, offerExpiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))
      : undefined,
    logoSrc,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const offerLetterPdf = await renderToBuffer(createElement(OfferLetterDocument, { data: offerLetterData }) as any)

  // Optionally include proposal PDF (fee breakdown)
  let proposalPdf: Buffer | undefined
  if (includeProposal) {
    const { ProposalDocument } = await import("@/lib/pdf-generator")
    const { getSetting } = await import("@/app/actions/settings")
    const globalTerms = await getSetting("PROPOSAL_TERMS", "All fees must be paid on or before the due date.")
    const terms = student.financial?.customTerms || globalTerms
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proposalPdf = await renderToBuffer(createElement(ProposalDocument, { student, terms, logoSrc }) as any)
  }

  const recipients = [student.email]
  if (student.parent1Email) recipients.push(student.parent1Email)

  const result = await sendOfferEmail({
    to: recipients,
    studentName: student.name,
    programName: student.program.name,
    batchYear: student.batch.year,
    offerExpiryDate: offerExpiresAt,
    bodyText: settings["OFFER_EMAIL_BODY"] || DEFAULT_OFFER_EMAIL_BODY,
    bankDetails: settings["BANK_DETAILS"] || DEFAULT_BANK_DETAILS,
    offerLetterPdf: Buffer.from(offerLetterPdf),
    proposalPdf: proposalPdf ? Buffer.from(proposalPdf) : undefined,
  })

  if (!result.ok) {
    if ("skipped" in result) return NextResponse.json({ error: result.reason }, { status: 503 })
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  // Stamp offerSentAt (only on first send); always update offerExpiresAt
  const now = new Date()
  await prisma.student.update({
    where: { id },
    data: {
      offerSentAt: student.offerSentAt ?? now,
      offerExpiresAt: student.offerSentAt ? student.offerExpiresAt : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return NextResponse.json({ ok: true, messageId: result.messageId, sentTo: recipients })
  } catch (err) {
    console.error("send-offer unhandled error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error sending offer" },
      { status: 500 }
    )
  }
}
