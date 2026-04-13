import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { syncFifoToDb } from "@/lib/fifo"

// Get payment history for a student
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: studentId } = await params

  const payments = await prisma.payment.findMany({
    where: { studentId },
    include: {
      recordedBy: {
        select: { name: true, email: true }
      },
      installment: {
        select: { label: true, year: true }
      }
    },
    orderBy: { date: "desc" }
  })

  return NextResponse.json(payments)
}

// Record a new payment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: studentId } = await params
  const body = await req.json()
  const {
    installmentId,
    paidAmount,
    paidDate,
    paymentMode,
    referenceNo,
    payerName,
    notes
  } = body

  if (!paidAmount || !paidDate || !paymentMode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the payment journal entry
      const payment = await tx.payment.create({
        data: {
          studentId,
          installmentId: installmentId || null,
          amount: paidAmount,
          date: new Date(paidDate),
          paymentMode,
          referenceNo: referenceNo || null,
          payerName: payerName || null,
          notes: notes || null,
          recordedById: dbUser?.id || null,
        }
      })

      // 2. Run FIFO across all installments and write statuses back
      //    This replaces the old per-installment status update.
      await syncFifoToDb(tx, studentId)

      return payment
    })

    return NextResponse.json({ success: true, paymentId: result.id })
  } catch (err) {
    console.error("Payment recording failed:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to record payment" }, { status: 500 })
  }
}
