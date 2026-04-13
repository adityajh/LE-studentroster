import { NextRequest, NextResponse } from "next/server"
import { put, del } from "@vercel/blob"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_TYPES = [
  "STUDENT_PHOTO",
  "TENTH_MARKSHEET",
  "TWELFTH_MARKSHEET",
  "ACCEPTANCE_LETTER",
  "AADHAR_CARD",
  "DRIVERS_LICENSE",
] as const

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: studentId } = await params

  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const docType = formData.get("type") as string | null

  if (!file || !docType) {
    return NextResponse.json({ error: "file and type are required" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(docType as typeof ALLOWED_TYPES[number])) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 })
  }
  if (file.size > 1 * 1024 * 1024) {
    return NextResponse.json({ error: "File exceeds 1 MB limit" }, { status: 413 })
  }

  // Delete existing document of same type if present
  const existing = await prisma.studentDocument.findFirst({
    where: { studentId, type: docType as typeof ALLOWED_TYPES[number] },
  })
  if (existing) {
    try { await del(existing.fileUrl) } catch { /* blob may already be gone */ }
    await prisma.studentDocument.delete({ where: { id: existing.id } })
  }

  const blob = await put(
    `students/${studentId}/${docType}/${file.name}`,
    file,
    { access: "public" }
  )

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })

  const doc = await prisma.studentDocument.create({
    data: {
      studentId,
      type: docType as typeof ALLOWED_TYPES[number],
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
      uploadedById: dbUser?.id ?? null,
    },
  })

  return NextResponse.json(doc)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: studentId } = await params
  const { docId } = await req.json()

  const doc = await prisma.studentDocument.findUnique({ where: { id: docId } })
  if (!doc || doc.studentId !== studentId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  try { await del(doc.fileUrl) } catch { /* blob may already be gone */ }
  await prisma.studentDocument.delete({ where: { id: docId } })

  return NextResponse.json({ ok: true })
}
