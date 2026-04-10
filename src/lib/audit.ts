import { prisma } from "@/lib/prisma"

export async function recordAuditLog({
  studentId,
  userId,
  field,
  oldValue,
  newValue,
  reason,
}: {
  studentId: string
  userId: string
  field: string
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
}) {
  return prisma.studentAuditLog.create({
    data: {
      studentId,
      changedBy: userId,
      field,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      reason: reason ?? null,
    },
  })
}
