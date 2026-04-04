import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex")
}

async function validateApiKey(req: NextRequest): Promise<boolean> {
  const key = req.headers.get("x-api-key")
  if (!key) return false
  const hashed = hashKey(key)
  const found = await prisma.apiKey.findFirst({
    where: { keyHash: hashed, isActive: true },
  })
  if (!found) return false
  // Update last used
  await prisma.apiKey.update({
    where: { id: found.id },
    data: { lastUsedAt: new Date() },
  })
  return true
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const valid = await validateApiKey(req)
  if (!valid) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 })
  }

  const { year: yearStr } = await params
  const year = parseInt(yearStr)
  if (isNaN(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 })
  }

  const batch = await prisma.batch.findUnique({
    where: { year },
    include: {
      programs: {
        select: {
          id: true,
          name: true,
          totalFee: true,
          registrationFee: true,
          year1Fee: true,
          year2Fee: true,
          year3Fee: true,
          targetStudents: true,
        },
        orderBy: { totalFee: "asc" },
      },
      feeSchedule: {
        select: {
          isLocked: true,
          lockedAt: true,
          offers: {
            select: {
              id: true,
              name: true,
              type: true,
              waiverAmount: true,
              deadline: true,
              conditions: true,
            },
          },
          scholarships: {
            select: {
              id: true,
              name: true,
              category: true,
              minAmount: true,
              maxAmount: true,
            },
            orderBy: { category: "asc" },
          },
        },
      },
    },
  })

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  return NextResponse.json({
    year: batch.year,
    name: batch.name,
    feeSchedule: {
      isLocked: batch.feeSchedule?.isLocked ?? false,
      lockedAt: batch.feeSchedule?.lockedAt ?? null,
      programs: batch.programs,
      offers: batch.feeSchedule?.offers ?? [],
      scholarships: batch.feeSchedule?.scholarships ?? [],
    },
  })
}
