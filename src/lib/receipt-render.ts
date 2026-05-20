/**
 * Shared receipt-rendering helpers.
 *
 * Used by:
 *   - GET /api/students/[id]/pay/[paymentId]/receipt   (download)
 *   - POST /api/students/[id]/pay/[paymentId]/receipt  (email)
 *   - scratch/send-test-receipt.ts                     (manual test)
 *
 * Single function path means a test receipt is byte-identical to the
 * receipt that would have been emailed to the student.
 */

import { prisma } from "@/lib/prisma"
import { ReceiptDocument } from "@/lib/receipt-pdf"
import { computeFeeLedger } from "@/lib/fee-ledger"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"

export async function buildLedgerForStudent(studentId: string) {
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
      ? { fee: Number(s.program?.registrationFee ?? 0), isPaid: true }
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

/** End-to-end: render the exact PDF buffer that would be emailed for this
 *  payment. Returns null if either student or payment isn't found. */
export async function renderReceiptPdfForPayment(studentId: string, paymentId: string): Promise<{
  buffer: Buffer
  student: NonNullable<Awaited<ReturnType<typeof buildLedgerForStudent>>>["student"]
  payment: NonNullable<Awaited<ReturnType<typeof prisma.payment.findUnique>>> & { installment?: { label: string } | null }
} | null> {
  const ctx = await buildLedgerForStudent(studentId)
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { installment: { select: { label: true } } },
  })
  if (!ctx || !payment || payment.studentId !== studentId) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(ReceiptDocument, {
    student: ctx.student,
    payment: { ...payment, amount: Number(payment.amount) },
    totalFee: ctx.ledger.totals.fee,
    totalReceived: ctx.ledger.totals.received,
    outstanding: ctx.ledger.totals.pending,
  }) as any)

  return { buffer: Buffer.from(buffer), student: ctx.student, payment }
}
