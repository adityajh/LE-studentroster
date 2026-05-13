import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { OfferLetterDocument, type OfferLetterData } from "@/lib/offer-letter-generator"
import { getSettings } from "@/app/actions/settings"
import fs from "fs"
import path from "path"

// Mock student data so the preview always renders. Real fields come from
// SystemSetting so the preview accurately reflects what an actual student
// would receive (body, terms, programme expectations, bank details).
const MOCK_STUDENT_NAME = "Ananya Sharma"
const MOCK_PROGRAM_NAME = "Working BBA"
const MOCK_BATCH_YEAR = 2026

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let logoSrc: string | undefined
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", "le-logo-light.png"))
    logoSrc = `data:image/png;base64,${buf.toString("base64")}`
  } catch { /* logo missing */ }

  const settings = await getSettings([
    "OFFER_LETTER_BODY",
    "BANK_DETAILS",
    "PROPOSAL_TERMS",
    "PROGRAM_EXPECTATIONS",
  ])

  const offerExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // Resolve merge tags in the body so the preview shows the substituted result
  const rawBody = settings["OFFER_LETTER_BODY"] || ""
  const bodyText = rawBody
    ? rawBody
        .replace(/\{\{studentName\}\}/g, MOCK_STUDENT_NAME)
        .replace(/\{\{programName\}\}/g, MOCK_PROGRAM_NAME)
        .replace(/\{\{batchYear\}\}/g, String(MOCK_BATCH_YEAR))
        .replace(/\{\{offerExpiryDate\}\}/g, offerExpiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))
    : undefined

  const data: OfferLetterData = {
    studentName: MOCK_STUDENT_NAME,
    programName: MOCK_PROGRAM_NAME,
    batchYear: MOCK_BATCH_YEAR,
    offerExpiresAt,
    registrationFee: 50000,
    baseFee: 1300000,
    year1Fee: 565000,
    year2Fee: 400000,
    year3Fee: 335000,
    offers: [
      { name: "Early Bird Discount", amount: 50000, deadline: null },
      { name: "7-Day Confirmation Waiver", amount: 25000, deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    ],
    scholarships: [
      { name: "Merit", amount: 15000 },
    ],
    netFee: 1235000,
    bankDetails: settings["BANK_DETAILS"] || "Storysells Education Pvt. Ltd\nBank: ICICI Bank, Bund Garden Branch, Pune\nAccount No: 000505026869\nIFSC: ICIC0000005",
    bodyText,
    terms: settings["PROPOSAL_TERMS"] || undefined,
    programExpectations: settings["PROGRAM_EXPECTATIONS"] || undefined,
    logoSrc,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(OfferLetterDocument, { data }) as any)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"sample-offer-letter.pdf\"",
    },
  })
}
