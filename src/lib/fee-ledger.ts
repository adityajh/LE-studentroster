/**
 * Central fee-ledger computation.
 *
 * Every view that needs to show "how much has been received against each
 * installment, what's pending, what's next due" should go through here, so
 * the Schedule tab on student detail, the Students-list `Next Due Amt`
 * column, the reminder-email amount, the dashboard outstanding tiles, and
 * any future view stay consistent.
 *
 * Responsibilities:
 *   1. Compute the effective fee per installment from the program scheme
 *      and the student's waivers/scholarships/deductions (so that Pattern A2
 *      students whose stored `installment.amount` is pre-waiver still
 *      produce the same number the Schedule tab shows).
 *   2. FIFO-allocate `totalPaid` across installments in (year, dueDate) order.
 *   3. Synthesize a year=0 "Registration" row when registration is tracked
 *      as a flag on `financial.registrationPaid` rather than as a real
 *      installment (so `Reg + Y1 + Y2 + Y3` always shows up as four rows,
 *      regardless of how the data is stored).
 */

import { splitWaivers } from "./fee-calc"

export const REG_SYNTH_ID = "__REG_SYNTH__"

export type LedgerInstallmentInput = {
  id: string
  year: number
  label: string
  /** Stored installment.amount. Used as a fallback when ANNUAL effective-fee
   *  computation isn't possible (e.g. ONE_TIME / CUSTOM plans). */
  amount: number
  dueDate: Date
  /** Optional — used only to mark the row in the returned ledger. */
  status?: string
}

export type LedgerRegInput = {
  fee: number
  /** From `financial.registrationPaid`. */
  isPaid: boolean
  paidDate?: Date | null
}

export type LedgerRow = {
  id: string
  year: number
  label: string
  fee: number
  received: number
  pending: number
  dueDate: Date
  status?: string
  isSynthetic: boolean
  isFullyPaid: boolean
}

export type FeeLedger = {
  rows: LedgerRow[]
  totals: { fee: number; received: number; pending: number }
  totalPaid: number
  /** Whatever portion of payments exceeds the schedule. Shouldn't happen for
   *  a healthy student, but we surface it for diagnostics. */
  surplus: number
  /** First row with `pending > 0`. Synthetic-registration counts. */
  nextDue: LedgerRow | null
}

export type LedgerWaiverInput = {
  /** Per-installment offer conditions (from the offer record). Used by
   *  splitWaivers to decide which waivers spread across years vs apply
   *  as one-time deductions on year 1. */
  offers: Array<{ conditions: unknown; waiverAmount: number }>
  scholarships: Array<{ amount: number; spreadAcrossYears: boolean }>
  /** Total of student deductions — applied to year 1 only. */
  totalDeductionAmount: number
}

export type LedgerProgramInput = {
  year1Fee: number
  year2Fee: number
  year3Fee: number
  /** Plan type. Only "ANNUAL" triggers waiver/deduction-based effective-fee
   *  computation; "ONE_TIME" / "CUSTOM" fall back to stored installment.amount. */
  installmentType?: string | null
}

export type ComputeLedgerInput = {
  installments: LedgerInstallmentInput[]
  totalPaid: number
  /** Pass when registration is tracked as a flag (no year=0 installment).
   *  If omitted (or `isPaid: false`) no synthetic row is inserted. */
  reg?: LedgerRegInput
  /** When provided, the ledger computes each installment's effective fee
   *  from program year fees − spread waivers − one-time waivers/deductions
   *  (year 1 only). When omitted, falls back to stored installment.amount. */
  program?: LedgerProgramInput
  waivers?: LedgerWaiverInput
}

/** Effective fee for a single year-N installment under the current scheme.
 *  Mirrors the inline `expectedInstFee` formerly duplicated in the student
 *  detail page. */
export function effectiveInstallmentFee(input: {
  year: number
  storedAmount: number
  program?: LedgerProgramInput
  waivers?: LedgerWaiverInput
  reg?: LedgerRegInput
}): number {
  const { year, storedAmount, program, waivers, reg } = input
  if (year === 0) return reg?.fee ?? storedAmount
  if (!program || !waivers) return storedAmount
  if (program.installmentType && program.installmentType !== "ANNUAL") return storedAmount

  const { spreadY1, spreadY2, spreadY3, onetimeTotal } = splitWaivers(
    waivers.offers,
    waivers.scholarships,
  )
  const spreadByYear: Record<number, number> = { 1: spreadY1, 2: spreadY2, 3: spreadY3 }
  const yearFees: Record<number, number> = {
    1: program.year1Fee,
    2: program.year2Fee,
    3: program.year3Fee,
  }
  const base = yearFees[year] ?? 0
  const yearSpread = spreadByYear[year] ?? 0
  const deductionForYear = year === 1 ? waivers.totalDeductionAmount : 0
  const onetimeForYear = year === 1 ? onetimeTotal : 0
  return Math.max(0, Math.round(base - yearSpread - onetimeForYear - deductionForYear))
}

export function computeFeeLedger(input: ComputeLedgerInput): FeeLedger {
  const { totalPaid } = input

  const withEffectiveFee = input.installments.map((inst) => ({
    ...inst,
    fee: effectiveInstallmentFee({
      year: inst.year,
      storedAmount: inst.amount,
      program: input.program,
      waivers: input.waivers,
      reg: input.reg,
    }),
  }))

  const sorted = [...withEffectiveFee].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.dueDate.getTime() - b.dueDate.getTime()
  })

  const hasRegInstallment = sorted.some((i) => i.year === 0)
  const includeSynthReg =
    !hasRegInstallment && !!input.reg && input.reg.fee > 0 && input.reg.isPaid

  let remaining = totalPaid
  const rows: LedgerRow[] = []

  if (includeSynthReg && input.reg) {
    const fee = input.reg.fee
    const received = Math.min(remaining, fee)
    remaining -= received
    rows.push({
      id: REG_SYNTH_ID,
      year: 0,
      label: "Registration Fee",
      fee,
      received,
      pending: Math.max(0, fee - received),
      // Synthetic reg rows don't have a real dueDate. Use earliest installment
      // dueDate so date-sorted consumers behave sensibly.
      dueDate: sorted[0]?.dueDate ?? new Date(0),
      isSynthetic: true,
      isFullyPaid: received >= fee,
    })
  }

  for (const inst of sorted) {
    const fee = inst.fee
    const received = Math.min(remaining, fee)
    remaining -= received
    rows.push({
      id: inst.id,
      year: inst.year,
      label: inst.label,
      fee,
      received,
      pending: Math.max(0, fee - received),
      dueDate: inst.dueDate,
      status: inst.status,
      isSynthetic: false,
      isFullyPaid: received >= fee,
    })
  }

  const totals = rows.reduce(
    (acc, r) => ({
      fee: acc.fee + r.fee,
      received: acc.received + r.received,
      pending: acc.pending + r.pending,
    }),
    { fee: 0, received: 0, pending: 0 },
  )
  const surplus = Math.max(0, totalPaid - totals.fee)
  const nextDue = rows.find((r) => r.pending > 0) ?? null

  return { rows, totals, totalPaid, surplus, nextDue }
}
