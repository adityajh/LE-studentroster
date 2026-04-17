import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { saveFeeLetterVersion, getActiveFeeLetterVersion } from "@/lib/fee-letter"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const active = await getActiveFeeLetterVersion(id)
  if (!active) return NextResponse.json({ letter: null })

  const history = await prisma.feeLetterVersion.findMany({
    where: { studentId: id, isActive: false },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ letter: active, history })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, role: true },
  })
  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const { id } = await params

  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } })
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 })
  if (!file.name.endsWith(".pdf")) return NextResponse.json({ error: "Only PDF files accepted" }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const version = await saveFeeLetterVersion(id, buffer, "UPLOADED", dbUser.id, file.name)

  return NextResponse.json({ ok: true, version })
}
