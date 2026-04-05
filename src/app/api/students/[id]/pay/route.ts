import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: studentId } = await params
  const body = await req.json()
  const { installmentId, paidAmount, paidDate, paymentMethod, notes } = body

  if (!installmentId || !paidAmount || !paidDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
  })

  if (!installment || installment.studentId !== studentId) {
    return NextResponse.json({ error: "Installment not found" }, { status: 404 })
  }

  if (installment.status === "PAID") {
    return NextResponse.json({ error: "Already paid" }, { status: 400 })
  }

  const updated = await prisma.installment.update({
    where: { id: installmentId },
    data: {
      status: "PAID",
      paidAmount,
      paidDate: new Date(paidDate),
      paymentMethod: paymentMethod ?? null,
      notes: notes ?? null,
    },
  })

  return NextResponse.json({ id: updated.id, status: updated.status })
}
