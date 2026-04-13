import type { PrismaClient } from "@prisma/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export type FifoInstallment = {
  id: string
  label: string
  amount: number   // DB amount — authoritative fee target for FIFO
  dueDate: Date
}

export type FifoPayment = {
  id: string
  amount: number
  date: Date
}

export type FifoAllocationRow = {
  installmentId: string
  label: string
  fee: number
  allocated: number   // how much of *this specific payment* went here
  cumAllocated: number // total allocated to this installment across all payments up to & including this one
}

// ─── Core FIFO algorithm ──────────────────────────────────────────────────────

/**
 * Compute how much of totalPaid is allocated to each installment in dueDate order.
 * Returns a Map keyed by installmentId.
 */
export function computeFifo(
  totalPaid: number,
  installments: FifoInstallment[]
): Map<string, { allocated: number; status: "PAID" | "PARTIAL" | "UNPAID" }> {
  const sorted = [...installments].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
  )
  let remaining = totalPaid
  const result = new Map<string, { allocated: number; status: "PAID" | "PARTIAL" | "UNPAID" }>()

  for (const inst of sorted) {
    const fee = inst.amount
    const allocated = Math.min(remaining, fee)
    remaining -= allocated
    result.set(inst.id, {
      allocated,
      status: allocated >= fee ? "PAID" : allocated > 0 ? "PARTIAL" : "UNPAID",
    })
  }
  return result
}

/**
 * Compute what a specific payment contributed to each installment.
 * Walks FIFO for all payments up to (and including) the target payment in date order,
 * then returns the incremental allocation that payment caused.
 */
export function computePaymentAllocation(
  targetPaymentId: string,
  allPayments: FifoPayment[],
  installments: FifoInstallment[]
): FifoAllocationRow[] {
  const sortedInsts = [...installments].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
  )
  // Sort payments by date; for same date put target last so prior payments are subtracted first
  const sortedPayments = [...allPayments].sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime()
    if (diff !== 0) return diff
    if (a.id === targetPaymentId) return 1
    if (b.id === targetPaymentId) return -1
    return 0
  })

  const targetIdx = sortedPayments.findIndex(p => p.id === targetPaymentId)
  if (targetIdx === -1) return []

  // Allocation state BEFORE this payment
  const totalBefore = sortedPayments
    .slice(0, targetIdx)
    .reduce((s, p) => s + p.amount, 0)

  // Allocation state AFTER this payment
  const totalAfter = totalBefore + sortedPayments[targetIdx].amount

  const allocBefore = computeFifo(totalBefore, installments)
  const allocAfter  = computeFifo(totalAfter, installments)

  const rows: FifoAllocationRow[] = []
  for (const inst of sortedInsts) {
    const before = allocBefore.get(inst.id)?.allocated ?? 0
    const after  = allocAfter.get(inst.id)?.allocated ?? 0
    const delta  = after - before
    if (delta > 0) {
      rows.push({
        installmentId: inst.id,
        label:         inst.label,
        fee:           inst.amount,
        allocated:     delta,
        cumAllocated:  after,
      })
    }
  }
  return rows
}

// ─── DB write-back ────────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

/**
 * Run FIFO for a student and write status + paidAmount back to every installment.
 * Must be called inside a Prisma transaction after any payment change.
 *
 * Time-based statuses (UPCOMING / DUE / OVERDUE) are preserved on unpaid installments.
 * Only PAID and PARTIAL are written here; the cron owns the time transitions.
 */
export async function syncFifoToDb(tx: TxClient, studentId: string): Promise<void> {
  const [payments, installments] = await Promise.all([
    tx.payment.findMany({
      where: { studentId },
      select: { amount: true, date: true },
    }),
    tx.installment.findMany({
      where: { studentId },
      orderBy: { dueDate: "asc" },
    }),
  ])

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const alloc = computeFifo(
    totalPaid,
    installments.map(i => ({
      id: i.id,
      label: i.label,
      amount: Number(i.amount),
      dueDate: i.dueDate,
    }))
  )

  // Batch updates by grouping into PAID / PARTIAL / unchanged buckets
  const paidIds: string[]    = []
  const partialMap = new Map<string, number>() // id → allocatedAmount
  const unpaidIds: string[]  = []

  for (const inst of installments) {
    const { allocated, status } = alloc.get(inst.id) ?? { allocated: 0, status: "UNPAID" as const }
    if (status === "PAID") {
      paidIds.push(inst.id)
    } else if (status === "PARTIAL") {
      partialMap.set(inst.id, allocated)
    } else {
      // UNPAID — if it was previously PAID or PARTIAL, clear paidAmount
      // (handles edge case where installment amount was increased via editor)
      if (inst.status === "PAID" || inst.status === "PARTIAL") {
        unpaidIds.push(inst.id)
      }
    }
  }

  const ops: Promise<unknown>[] = []

  if (paidIds.length > 0) {
    ops.push(
      tx.installment.updateMany({
        where: { id: { in: paidIds } },
        data: { status: "PAID" },
      })
    )
    // paidAmount = full amount per installment — do individually since amounts differ
    for (const id of paidIds) {
      const inst = installments.find(i => i.id === id)!
      ops.push(tx.installment.update({ where: { id }, data: { paidAmount: Number(inst.amount) } }))
    }
  }

  for (const [id, allocated] of partialMap) {
    ops.push(
      tx.installment.update({
        where: { id },
        data: { status: "PARTIAL", paidAmount: allocated },
      })
    )
  }

  // Restore unpaid installments: clear paidAmount, restore time-based status
  for (const id of unpaidIds) {
    const inst = installments.find(i => i.id === id)!
    const now = new Date()
    const graceCutoff = new Date(now)
    graceCutoff.setDate(graceCutoff.getDate() - 7)
    const timeStatus =
      inst.dueDate <= graceCutoff ? "OVERDUE" :
      inst.dueDate <= now         ? "DUE"     :
                                    "UPCOMING"
    ops.push(
      tx.installment.update({
        where: { id },
        data: { status: timeStatus, paidAmount: null },
      })
    )
  }

  await Promise.all(ops)
}
