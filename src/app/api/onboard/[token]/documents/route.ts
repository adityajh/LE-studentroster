import { NextRequest, NextResponse } from "next/server"
import { put, del } from "@vercel/blob"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

const ALLOWED_TYPES = [
  "STUDENT_PHOTO",
  "TENTH_MARKSHEET",
  "TWELFTH_MARKSHEET",
  "ACCEPTANCE_LETTER",
  "AADHAR_CARD",
  "DRIVERS_LICENSE",
] as const

async function resolveToken(raw: string) {
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex")
  return prisma.onboardingToken.findUnique({ where: { tokenHash } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const record = await resolveToken(token)

  if (!record) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
  if (record.expiresAt < new Date()) return NextResponse.json({ error: "Link expired" }, { status: 410 })

  const student = await prisma.student.findUnique({ where: { id: record.studentId } })
  if (student?.selfOnboardingStatus === "APPROVED") {
    return NextResponse.json({ error: "Profile already approved — no further changes allowed" }, { status: 409 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const docType = formData.get("type") as string | null

  if (!file || !docType) {
    return NextResponse.json({ error: "file and type are required" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(docType as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 })
  }
  if (file.size > 1 * 1024 * 1024) {
    return NextResponse.json({ error: "File exceeds 1 MB limit" }, { status: 413 })
  }

  const studentId = record.studentId

  // Replace existing document of same type
  const existing = await prisma.studentDocument.findFirst({
    where: { studentId, type: docType as (typeof ALLOWED_TYPES)[number] },
  })
  if (existing) {
    try { await del(existing.fileUrl) } catch { /* already gone */ }
    await prisma.studentDocument.delete({ where: { id: existing.id } })
  }

  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  let blob
  try {
    blob = await put(
      `students/${studentId}/${docType}/${safeName}`,
      fileBuffer,
      {
        access: "public",
        contentType: file.type || "application/octet-stream",
        token: process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN,
      }
    )
  } catch (err) {
    console.error("[blob upload error]", err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Blob upload failed: ${msg}` }, { status: 500 })
  }

  const doc = await prisma.studentDocument.create({
    data: {
      studentId,
      type: docType as (typeof ALLOWED_TYPES)[number],
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
      uploadedById: null, // self-uploaded; no admin session
    },
  })

  return NextResponse.json({ id: doc.id, type: doc.type, fileName: doc.fileName, fileUrl: doc.fileUrl })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const record = await resolveToken(token)

  if (!record) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
  if (record.expiresAt < new Date()) return NextResponse.json({ error: "Link expired" }, { status: 410 })

  const student = await prisma.student.findUnique({ where: { id: record.studentId } })
  if (student?.selfOnboardingStatus === "APPROVED") {
    return NextResponse.json({ error: "Profile already approved" }, { status: 409 })
  }

  const { docId } = await req.json()
  const doc = await prisma.studentDocument.findUnique({ where: { id: docId } })
  if (!doc || doc.studentId !== record.studentId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  try { await del(doc.fileUrl) } catch { /* already gone */ }
  await prisma.studentDocument.delete({ where: { id: docId } })

  return NextResponse.json({ ok: true })
}
