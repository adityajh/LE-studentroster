import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendReceiptEmail } from "@/lib/mail"
import { renderReceiptPdfForPayment } from "@/lib/receipt-render"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: studentId, paymentId } = await params
  const result = await renderReceiptPdfForPayment(studentId, paymentId)
  if (!result) return NextResponse.json({ error: "Record not found" }, { status: 404 })

  const filename = `Receipt_${result.payment.receiptNo ?? `${result.student.rollNo ?? result.student.id.slice(-6)}_${result.payment.id.slice(-6).toUpperCase()}`}`

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: studentId, paymentId } = await params
  const result = await renderReceiptPdfForPayment(studentId, paymentId)
  if (!result) return NextResponse.json({ error: "Record not found" }, { status: 404 })
  const { buffer, student, payment } = result

  try {
    const to = [student.email].filter(Boolean) as string[]
    const cc = [
      student.parent1Email,
      student.parent2Email,
      student.localGuardianEmail,
    ].filter(Boolean) as string[]

    if (to.length === 0) {
      return NextResponse.json({ error: "No student email found" }, { status: 400 })
    }

    await sendReceiptEmail({
      to,
      cc,
      studentName: student.name,
      amount: Number(payment.amount),
      paymentDate: payment.date,
      paymentMode: payment.paymentMode || 'Payment',
      installmentLabel: payment.installment?.label || 'Advance Payment',
      receiptNo: payment.receiptNo ?? `RCP-${student.rollNo ?? student.id.slice(-6)}-${payment.id.slice(-6).toUpperCase()}`,
      pdfBuffer: buffer,
    })

    await prisma.payment.update({
      where: { id: paymentId },
      data: { receiptSentAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to send receipt email:", err)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
