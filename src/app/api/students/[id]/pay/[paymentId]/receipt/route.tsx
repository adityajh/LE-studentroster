import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ReceiptDocument } from "@/lib/receipt-pdf"
import { sendReceiptEmail } from "@/lib/mail"
import { renderToStream, renderToBuffer } from "@react-pdf/renderer"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: studentId, paymentId } = await params

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      program: true,
      batch: true,
      financial: true,
    }
  })

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      installment: { select: { label: true } }
    }
  })

  if (!student || !payment || payment.studentId !== studentId) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 })
  }

  // Calculate total paid across all payments for this student
  const allPayments = await prisma.payment.findMany({
    where: { studentId }
  })
  const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const netFee = Number(student.financial?.netFee ?? 0)

  const filename = `Receipt_${student.rollNo}_${payment.id.slice(-6).toUpperCase()}`

  // Return PDF stream
  const stream = await renderToStream(
    <ReceiptDocument 
      student={student} 
      payment={{ ...payment, amount: Number(payment.amount) }} 
      netFee={netFee}
      totalPaid={totalPaid}
    />
  )

  return new NextResponse(stream as unknown as ReadableStream, {
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

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      program: true,
      batch: true,
      financial: true,
    }
  })

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      installment: { select: { label: true } }
    }
  })

  if (!student || !payment || payment.studentId !== studentId) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 })
  }

  // Calculate stats for the PDF
  const allPayments = await prisma.payment.findMany({
    where: { studentId }
  })
  const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const netFee = Number(student.financial?.netFee ?? 0)

  const receiptNo = `RCP-${student.rollNo}-${payment.id.slice(-6).toUpperCase()}`

  try {
    // Generate PDF buffer
    const buffer = await renderToBuffer(
      <ReceiptDocument 
        student={student} 
        payment={{ ...payment, amount: Number(payment.amount) }} 
        netFee={netFee}
        totalPaid={totalPaid}
      />
    )

    // Collect all recipient emails
    const to = [student.email].filter(Boolean) as string[]
    const cc = [
      student.parent1Email,
      student.parent2Email,
      student.localGuardianEmail
    ].filter(Boolean) as string[]

    if (to.length === 0) {
      return NextResponse.json({ error: "No student email found" }, { status: 400 })
    }

    // Send email
    await sendReceiptEmail({
      to,
      cc,
      studentName: student.name,
      amount: Number(payment.amount),
      paymentDate: payment.date,
      paymentMode: payment.paymentMode || 'Payment',
      installmentLabel: payment.installment?.label || 'Advance Payment',
      receiptNo,
      pdfBuffer: buffer,
    })

    // Update payment record with receiptSentAt
    await prisma.payment.update({
      where: { id: paymentId },
      data: { receiptSentAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Failed to send receipt email:", err)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
