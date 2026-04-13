import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { OfferLetterDocument, type OfferLetterData } from "@/lib/offer-letter-generator"
import fs from "fs"
import path from "path"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let logoSrc: string | undefined
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", "le-logo-light.png"))
    logoSrc = `data:image/png;base64,${buf.toString("base64")}`
  } catch { /* logo missing */ }

  const data: OfferLetterData = {
    studentName: "Ananya Sharma",
    programName: "LE UG-MED",
    batchYear: 2025,
    offerExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    registrationFee: 50000,
    baseFee: 270000,   // y1+y2+y3
    year1Fee: 90000,
    year2Fee: 90000,
    year3Fee: 90000,
    offers: [
      { name: "Early Bird Discount", amount: 20000, deadline: null },
      { name: "7-Day Confirmation Waiver", amount: 10000, deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    ],
    scholarships: [
      { name: "Merit Scholarship", amount: 15000 },
    ],
    netFee: 235000,  // 270000 - 20000 - 15000
    bankDetails: "Storysells Education Pvt. Ltd\nBank: ICICI Bank, Bund Garden Branch, Pune\nAccount No: 000505026869\nIFSC: ICIC0000005",
    bodyText: "We are delighted to offer you admission to {{programName}} at Let's Enterprise. This programme is designed for students who are ready to learn by doing, reflect deeply, and grow through real-world exposure.",
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
