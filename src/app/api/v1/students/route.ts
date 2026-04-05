import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")
  if (!apiKey) {
    return NextResponse.json({ error: "Missing x-api-key header" }, { status: 401 })
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex")
  const key = await prisma.apiKey.findUnique({ where: { keyHash } })

  if (!key || !key.isActive) {
    return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 403 })
  }

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  })

  const { searchParams } = new URL(req.url)
  const batchYear = searchParams.get("batch") ? parseInt(searchParams.get("batch")!) : undefined
  const status = searchParams.get("status")
  const rollNo = searchParams.get("rollNo")

  const students = await prisma.student.findMany({
    where: {
      ...(batchYear ? { batch: { year: batchYear } } : {}),
      ...(status ? { status: status as "ACTIVE" | "ALUMNI" | "WITHDRAWN" } : {}),
      ...(rollNo ? { rollNo: { contains: rollNo, mode: "insensitive" } } : {}),
    },
    include: {
      batch: { select: { year: true, name: true } },
      program: { select: { name: true, totalFee: true } },
      financial: {
        select: {
          netFee: true,
          installmentType: true,
          registrationPaid: true,
        },
      },
    },
    orderBy: [{ batch: { year: "desc" } }, { rollNo: "asc" }],
  })

  return NextResponse.json({
    count: students.length,
    students: students.map((s) => ({
      rollNo: s.rollNo,
      name: s.name,
      email: s.email,
      contact: s.contact,
      status: s.status,
      batch: s.batch.year,
      program: s.program.name,
      netFee: s.financial?.netFee ?? null,
      installmentType: s.financial?.installmentType ?? null,
      enrollmentDate: s.enrollmentDate,
    })),
  })
}
