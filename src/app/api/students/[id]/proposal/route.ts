import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ProposalDocument } from "@/lib/pdf-generator"
import { generateDocxProposal } from "@/lib/docx-generator"
import { renderToStream } from "@react-pdf/renderer"
import { getSetting } from "@/app/actions/settings"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const format = req.nextUrl.searchParams.get("format") || "pdf"

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

  const filename = `Proposal_${student.rollNo}_${student.name.replace(/\s+/g, "_")}`

  if (format === "pdf") {
    // Return PDF
    const stream = await renderToStream(ProposalDocument({ student, terms }))
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    })
  } else if (format === "docx") {
    // Return Word Document
    const buffer = await generateDocxProposal(student, terms)
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    })
  }

  return NextResponse.json({ error: "Invalid format" }, { status: 400 })
}
