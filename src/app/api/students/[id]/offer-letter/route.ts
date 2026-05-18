import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { OfferLetterDocument } from "@/lib/offer-letter-generator"
import { buildOfferLetterDataForStudent } from "@/lib/offer-letter-data"

/**
 * GET /api/students/[id]/offer-letter
 *
 * Renders the same offer-letter PDF that `POST send-offer` would email, and
 * returns it inline so the admin can preview before clicking Send.
 *
 * Uses `buildOfferLetterDataForStudent` so the preview and the emailed PDF
 * are byte-identical (modulo the email body, which lives on the email side).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    const { data, student } = await buildOfferLetterDataForStudent(id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf = await renderToBuffer(createElement(OfferLetterDocument, { data }) as any)

    const studentSlug = student.name.replace(/\s+/g, "")
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="LE-OfferLetter-${studentSlug}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to render offer letter"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
