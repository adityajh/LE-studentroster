/**
 * Per-payment FIFO allocation + DB sync of installment status / paidAmount.
 *
 * As of v1.18.2 this module is a thin wrapper over [src/lib/fee-ledger.ts](src/lib/fee-ledger.ts).
 * That central function is the single source of truth for "how is total
 * paid allocated across installments" — including:
 *   - sorting by (year, dueDate)
 *   - synthesizing a registration row when reg is tracked as a flag
 *   - using effective per-installment fee (program × waivers) for ANNUAL
 *     plans, or stored installment.amount otherwise
 *
 * What this file still provides:
 *   - `computePaymentAllocation(payment, all-payments, ledger-input)` —
 *     "incremental" view: how much of this specific payment landed on
 *     each installment, derived by diffing ledgers before/after.
 *   - `syncFifoToDb(tx, studentId)` — write installment.status and
 *     paidAmount to the DB so other queries see the same truth.
 */

import type { PrismaClient } from "@prisma/client"
import {
  computeFeeLedger,
  type ComputeLedgerInput,
  type LedgerInstallmentInput,
  type LedgerRegInput,
  type LedgerProgramInput,
  type LedgerWaiverInput,
} from "./fee-ledger"

// ─── Types ────────────────────────────────────────────────────────────────────

export type FifoPayment = {
  id: string
  amount: number
  date: Date
}

export type FifoAllocationRow = {
  installmentId: string
  label: string
  fee: number
  allocated: number    // how much of *this specific payment* went here
  cumAllocated: number // total allocated to this installment across all payments up to & including this one
}

export type LedgerContext = {
  installments: LedgerInstallmentInput[]
  reg?: LedgerRegInput
  program?: LedgerProgramInput
  waivers?: LedgerWaiverInput
}

// ─── Per-payment incremental allocation ───────────────────────────────────────

/**
 * Returns how much of the target payment landed on each installment by
 * diffing the ledger state before vs after that payment.
 *
 * For same-date payments, the target is treated as the *last* one processed
 * so that other same-date payments are counted in the "before" snapshot.
 * The total deltas always sum to the payment amount.
 */
export function computePaymentAllocation(
  targetPaymentId: string,
  allPayments: FifoPayment[],
  context: LedgerContext,
): FifoAllocationRow[] {
  const sortedPayments = [...allPayments].sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime()
    if (diff !== 0) return diff
    if (a.id === targetPaymentId) return 1
    if (b.id === targetPaymentId) return -1
    return 0
  })

  const targetIdx = sortedPayments.findIndex(p => p.id === targetPaymentId)
  if (targetIdx === -1) return []

  const totalBefore = sortedPayments.slice(0, targetIdx).reduce((s, p) => s + p.amount, 0)
  const totalAfter = totalBefore + sortedPayments[targetIdx].amount

  const ledgerBefore = computeFeeLedger({ totalPaid: totalBefore, ...context } as ComputeLedgerInput)
  const ledgerAfter = computeFeeLedger({ totalPaid: totalAfter, ...context } as ComputeLedgerInput)

  const beforeReceivedById = new Map<string, number>(
    ledgerBefore.rows.map(r => [r.id, r.received])
  )

  const rows: FifoAllocationRow[] = []
  for (const r of ledgerAfter.rows) {
    const before = beforeReceivedById.get(r.id) ?? 0
    const delta = r.received - before
    if (delta > 0) {
      rows.push({
        // The synthetic registration row's id is the sentinel REG_SYNTH_ID;
        // callers can render the label but shouldn't try to link to it.
        installmentId: r.id,
        label: r.label,
        fee: r.fee,
        allocated: delta,
        cumAllocated: r.received,
      })
    }
  }
  return rows
}

// ─── DB write-back ────────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

/**
 * Compute the canonical ledger for a student and write installment.status +
 * installment.paidAmount back to the DB so other queries (students list,
 * dashboard tiles, reminder query filter, etc.) see the same truth.
 *
 * PAID / PARTIAL are owned by this function. Time-based statuses (UPCOMING /
 * DUE / OVERDUE) are owned by the cron — if an installment that was PAID or
 * PARTIAL no longer has any FIFO allocation (e.g. a payment was edited
 * downward), we reset it to a time-based status here.
 */
export async function syncFifoToDb(tx: TxClient, studentId: string): Promise<void> {
  const student = await tx.student.findUnique({
    where: { id: studentId },
    include: {
      program: true,
      financial: true,
      offers: { include: { offer: true } },
      scholarships: { include: { scholarship: true } },
      deductions: true,
      installments: true,
      payments: { select: { amount: true } },
    },
  })
  if (!student) return

  const totalPaid = student.payments.reduce((s, p) => s + Number(p.amount), 0)

  const ledger = computeFeeLedger({
    totalPaid,
    installments: student.installments.map(i => ({
      id: i.id,
      year: i.year,
      label: i.label,
      amount: Number(i.amount),
      dueDate: i.dueDate,
      status: i.status,
    })),
    reg: student.financial?.registrationPaid
      ? {
          fee: student.financial.registrationFeeOverride != null
            ? Number(student.financial.registrationFeeOverride)
            : Number(student.program?.registrationFee ?? 0),
          isPaid: true,
        }
      : undefined,
    program: student.program ? {
      year1Fee: Number(student.program.year1Fee),
      year2Fee: Number(student.program.year2Fee),
      year3Fee: Number(student.program.year3Fee),
      installmentType: student.financial?.installmentType ?? null,
    } : undefined,
    waivers: {
      offers: student.offers.map(o => ({ conditions: (o.offer as { conditions: unknown }).conditions, waiverAmount: Number(o.waiverAmount) })),
      scholarships: student.scholarships.map(sc => ({ amount: Number(sc.amount), spreadAcrossYears: (sc.scholarship as { spreadAcrossYears: boolean }).spreadAcrossYears })),
      totalDeductionAmount: student.deductions.reduce((s, d) => s + Number(d.amount), 0),
    },
  })

  const now = new Date()
  const graceCutoff = new Date(now)
  graceCutoff.setDate(graceCutoff.getDate() - 7)

  const ops: Promise<unknown>[] = []

  for (const row of ledger.rows) {
    if (row.isSynthetic) continue
    const inst = student.installments.find(i => i.id === row.id)
    if (!inst) continue

    const isFullyPaid = row.received >= row.fee && row.fee > 0
    const isPartial = row.received > 0 && row.received < row.fee

    if (isFullyPaid) {
      ops.push(tx.installment.update({
        where: { id: row.id },
        data: { status: "PAID", paidAmount: row.fee },
      }))
    } else if (isPartial) {
      ops.push(tx.installment.update({
        where: { id: row.id },
        data: { status: "PARTIAL", paidAmount: row.received },
      }))
    } else {
      // Zero received. If the row was previously PAID/PARTIAL we need to
      // reset it back to a time-based status (mirrors the old behaviour).
      if (inst.status === "PAID" || inst.status === "PARTIAL") {
        const timeStatus =
          inst.dueDate <= graceCutoff ? "OVERDUE" :
          inst.dueDate <= now         ? "DUE"     :
                                        "UPCOMING"
        ops.push(tx.installment.update({
          where: { id: row.id },
          data: { status: timeStatus, paidAmount: null },
        }))
      }
    }
  }

  await Promise.all(ops)
}
