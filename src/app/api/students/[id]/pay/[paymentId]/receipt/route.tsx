import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ReceiptDocument } from "@/lib/receipt-pdf"
import { sendReceiptEmail } from "@/lib/mail"
import { renderToStream, renderToBuffer } from "@react-pdf/renderer"
import { computeFeeLedger } from "@/lib/fee-ledger"

async function buildLedgerForStudent(studentId: string) {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      program: true,
      batch: true,
      financial: true,
      offers: { include: { offer: true } },
      scholarships: { include: { scholarship: true } },
      deductions: true,
      installments: { orderBy: { year: "asc" } },
      payments: { select: { amount: true } },
    },
  })
  if (!s) return null
  const totalPaid = s.payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const ledger = computeFeeLedger({
    totalPaid,
    installments: s.installments.map(i => ({
      id: i.id, year: i.year, label: i.label,
      amount: Number(i.amount), dueDate: i.dueDate, status: i.status,
    })),
    reg: s.financial?.registrationPaid
      ? {
          fee: s.financial.registrationFeeOverride != null
            ? Number(s.financial.registrationFeeOverride)
            : Number(s.program?.registrationFee ?? 0),
          isPaid: true,
        }
      : undefined,
    program: s.program ? {
      year1Fee: Number(s.program.year1Fee),
      year2Fee: Number(s.program.year2Fee),
      year3Fee: Number(s.program.year3Fee),
      installmentType: s.financial?.installmentType ?? null,
    } : undefined,
    waivers: {
      offers: s.offers.map(o => ({ conditions: (o.offer as { conditions: unknown }).conditions, waiverAmount: Number(o.waiverAmount) })),
      scholarships: s.scholarships.map(sc => ({ amount: Number(sc.amount), spreadAcrossYears: (sc.scholarship as { spreadAcrossYears: boolean }).spreadAcrossYears })),
      totalDeductionAmount: s.deductions.reduce((sum, d) => sum + Number(d.amount), 0),
    },
  })
  return { student: s, ledger }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: studentId, paymentId } = await params

  const ctx = await buildLedgerForStudent(studentId)
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { installment: { select: { label: true } } },
  })

  if (!ctx || !payment || payment.studentId !== studentId) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 })
  }

  const filename = `Receipt_${payment.receiptNo ?? `${ctx.student.rollNo ?? ctx.student.id.slice(-6)}_${payment.id.slice(-6).toUpperCase()}`}`

  const stream = await renderToStream(
    <ReceiptDocument
      student={ctx.student}
      payment={{ ...payment, amount: Number(payment.amount) }}
      totalFee={ctx.ledger.totals.fee}
      totalReceived={ctx.ledger.totals.received}
      outstanding={ctx.ledger.totals.pending}
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

  const ctx = await buildLedgerForStudent(studentId)
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { installment: { select: { label: true } } },
  })

  if (!ctx || !payment || payment.studentId !== studentId) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 })
  }

  try {
    const buffer = await renderToBuffer(
      <ReceiptDocument
        student={ctx.student}
        payment={{ ...payment, amount: Number(payment.amount) }}
        totalFee={ctx.ledger.totals.fee}
        totalReceived={ctx.ledger.totals.received}
        outstanding={ctx.ledger.totals.pending}
      />
    )

    const to = [ctx.student.email].filter(Boolean) as string[]
    const cc = [
      ctx.student.parent1Email,
      ctx.student.parent2Email,
      ctx.student.localGuardianEmail,
    ].filter(Boolean) as string[]

    if (to.length === 0) {
      return NextResponse.json({ error: "No student email found" }, { status: 400 })
    }

    await sendReceiptEmail({
      to,
      cc,
      studentName: ctx.student.name,
      amount: Number(payment.amount),
      paymentDate: payment.date,
      paymentMode: payment.paymentMode || 'Payment',
      installmentLabel: payment.installment?.label || 'Advance Payment',
      receiptNo: payment.receiptNo ?? `RCP-${ctx.student.rollNo ?? ctx.student.id.slice(-6)}-${payment.id.slice(-6).toUpperCase()}`,
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
