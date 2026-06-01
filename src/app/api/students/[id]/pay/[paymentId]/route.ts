import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { syncFifoToDb } from "@/lib/fifo"
import { recordAuditLog } from "@/lib/audit"

// Delete a recorded payment (Admin only).
// Removes the Payment journal entry, then re-runs FIFO so installment
// statuses/paidAmounts reflect the now-smaller set of payments. The deletion
// is recorded in the student audit log.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  })

  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can delete payments." }, { status: 403 })
  }

  const { id: studentId, paymentId } = await params

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment || payment.studentId !== studentId) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  // Optional reason supplied by the caller for the audit trail.
  let reason: string | null = null
  try {
    const body = await req.json()
    reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null
  } catch {
    // No body / not JSON — reason stays null.
  }

  const oldValue = [
    `₹${Number(payment.amount).toLocaleString("en-IN")}`,
    `on ${new Date(payment.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    payment.paymentMode ? `via ${payment.paymentMode}` : null,
    payment.referenceNo ? `ref ${payment.referenceNo}` : null,
    payment.receiptNo ? `(${payment.receiptNo})` : null,
  ]
    .filter(Boolean)
    .join(" ")

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Remove the payment journal entry.
      await tx.payment.delete({ where: { id: paymentId } })

      // 2. Recompute FIFO across remaining payments and write statuses back.
      await syncFifoToDb(tx, studentId)

      // 3. Audit the deletion.
      await recordAuditLog({
        studentId,
        userId: dbUser.id,
        field: "Payment deleted",
        oldValue,
        newValue: null,
        reason,
      })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Payment deletion failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete payment" },
      { status: 500 }
    )
  }
}
