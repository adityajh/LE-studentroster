import { put } from "@vercel/blob"
import { prisma } from "./prisma"

const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN

/**
 * Uploads a fee letter PDF buffer to Vercel Blob, deactivates any existing
 * active version, and inserts a new FeeLetterVersion record.
 * Returns the new record.
 */
export async function saveFeeLetterVersion(
  studentId: string,
  pdfBuffer: Buffer,
  source: "GENERATED" | "UPLOADED",
  createdById?: string | null,
  uploadedFileName?: string,
) {
  const fileName = uploadedFileName ?? `fee-letter-${studentId}-${Date.now()}.pdf`

  const blob = await put(
    `fee-letters/${studentId}/${fileName}`,
    pdfBuffer,
    {
      access: "public",
      contentType: "application/pdf",
      token: BLOB_TOKEN,
    }
  )

  // Deactivate all existing active versions
  await prisma.feeLetterVersion.updateMany({
    where: { studentId, isActive: true },
    data: { isActive: false },
  })

  return prisma.feeLetterVersion.create({
    data: {
      studentId,
      fileUrl: blob.url,
      fileName,
      fileSize: pdfBuffer.length,
      source,
      isActive: true,
      createdById: createdById ?? null,
    },
  })
}

/** Returns the active fee letter for a student, or null. */
export function getActiveFeeLetterVersion(studentId: string) {
  return prisma.feeLetterVersion.findFirst({
    where: { studentId, isActive: true },
    include: { createdBy: { select: { name: true } } },
  })
}
