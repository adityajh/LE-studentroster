import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ProposalDocument } from "@/lib/pdf-generator"
import { renderToStream } from "@react-pdf/renderer"
import { getSetting } from "@/app/actions/settings"
import { getActiveFeeLetterVersion } from "@/lib/fee-letter"
import fs from "fs"
import path from "path"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Serve stored letter if one exists
  const activeLetter = await getActiveFeeLetterVersion(id)
  if (activeLetter) {
    const upstream = await fetch(activeLetter.fileUrl)
    if (upstream.ok) {
      const disposition = `attachment; filename="${activeLetter.fileName}"`
      return new NextResponse(upstream.body, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": disposition,
        },
      })
    }
  }

  // No stored letter — generate fresh (older students, or Blob fetch failed)
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      program: true,
      batch: true,
      financial: true,
      installments: { orderBy: { dueDate: "asc" } },
      offers: { include: { offer: true } },
      scholarships: { include: { scholarship: true } },
      deductions: true,
    },
  })

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 })
  }

  const globalTerms = await getSetting("PROPOSAL_TERMS", "1. All fees laid out in the structure above must be paid on or before the due date.")
  const terms = student.financial?.customTerms || globalTerms
  const programExpectations = (await getSetting("PROGRAM_EXPECTATIONS", "")) || undefined

  const programSlug = student.program.name.split(/\s*[-–]\s*/)[0].trim().replace(/\s+/g, "")
  const studentSlug = student.name.replace(/\s+/g, "")
  const filename = `LE-${programSlug}-${studentSlug}-FeeDetails`

  // Load logo as base64
  let logoSrc: string | undefined
  try {
    const logoBuf = fs.readFileSync(path.join(process.cwd(), "public", "le-logo-light.png"))
    logoSrc = `data:image/png;base64,${logoBuf.toString("base64")}`
  } catch {
    // logo missing — PDF will fall back to text
  }

  const stream = await renderToStream(ProposalDocument({ student, terms, programExpectations, logoSrc }))
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
    },
  })
}
