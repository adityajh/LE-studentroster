import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  })
  if (!dbUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      status: true,
      parent1Name: true, parent1Email: true, parent1Phone: true,
      parent2Name: true, parent2Email: true, parent2Phone: true,
      documents: { select: { type: true } },
    },
  })
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

  if (student.status !== "ONBOARDING") {
    return NextResponse.json({ error: "Student is not in ONBOARDING status" }, { status: 409 })
  }

  // Required-fields rule (matches onboard wizard + self-onboard form)
  const REQUIRED_DOC_TYPES = ["STUDENT_PHOTO", "AADHAR_CARD", "TWELFTH_MARKSHEET"] as const
  const docLabels: Record<string, string> = {
    STUDENT_PHOTO: "Student Photo",
    AADHAR_CARD: "Aadhar Card",
    TWELFTH_MARKSHEET: "12th Marksheet",
  }
  const missing: string[] = []
  if (!student.parent1Name?.trim()) missing.push("Parent / Guardian 1 name")
  if (!student.parent1Email?.trim()) missing.push("Parent / Guardian 1 email")
  if (!student.parent1Phone?.trim()) missing.push("Parent / Guardian 1 phone")
  if (!student.parent2Name?.trim()) missing.push("Parent / Guardian 2 name")
  if (!student.parent2Email?.trim()) missing.push("Parent / Guardian 2 email")
  if (!student.parent2Phone?.trim()) missing.push("Parent / Guardian 2 phone")
  const docTypeSet = new Set(student.documents.map((d) => d.type))
  for (const t of REQUIRED_DOC_TYPES) {
    if (!docTypeSet.has(t)) missing.push(docLabels[t])
  }
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Cannot complete onboarding — missing required: ${missing.join(", ")}.` },
      { status: 400 }
    )
  }

  await prisma.$transaction([
    prisma.student.update({
      where: { id },
      data: { status: "ACTIVE" },
    }),
    prisma.studentAuditLog.create({
      data: {
        studentId: id,
        changedBy: dbUser.id,
        field: "status",
        oldValue: "ONBOARDING",
        newValue: "ACTIVE",
        reason: "Onboarding completed by admin",
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
