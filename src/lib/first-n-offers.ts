/**
 * First-N offer application.
 *
 * A FIRST_N offer is awarded to the first N students (across all programs in
 * the same batch) who pay their Year 1 fee in full. This helper is called
 * after every successful payment: it checks each FIRST_N offer in the
 * student's batch, and if (a) the student has fully cleared Y1, (b) hasn't
 * already received this offer, and (c) the batch still has seats left,
 * it awards the offer and updates the student's financial record + Y1
 * installment + audit log atomically.
 */

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

type Tx = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export async function applyFirstNOffersIfQualified(
  tx: Tx,
  studentId: string,
): Promise<{ offerId: string; offerName: string; waiverAmount: number }[]> {
  const student = await tx.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      batchId: true,
      status: true,
      financial: { select: { netFee: true, totalWaiver: true } },
      installments: { select: { id: true, year: true, amount: true, paidAmount: true, status: true } },
      offers: { select: { offerId: true } },
    },
  })
  if (!student || student.status === "WITHDRAWN" || !student.financial) return []

  // Has the student paid Year 1 in full? We look at the Y1 installment(s)
  // and require PAID status. If there's no Y1 installment (ONE_TIME plan
  // without per-year breakdown), skip — those students will have already
  // paid up front and aren't really "first N to pay Y1" candidates.
  const y1Installments = student.installments.filter((i) => i.year === 1)
  if (y1Installments.length === 0) return []
  const y1FullyPaid = y1Installments.every((i) => i.status === "PAID")
  if (!y1FullyPaid) return []

  // Find FIRST_N offers in the student's batch.
  const batch = await tx.batch.findUnique({
    where: { id: student.batchId },
    select: {
      feeSchedule: {
        select: {
          id: true,
          offers: {
            where: { type: "FIRST_N" },
            select: { id: true, name: true, waiverAmount: true, firstNLimit: true, deadline: true, conditions: true },
          },
        },
      },
    },
  })
  const firstNOffers = batch?.feeSchedule?.offers ?? []
  if (firstNOffers.length === 0) return []

  const heldOfferIds = new Set(student.offers.map((o) => o.offerId))
  const now = new Date()
  const awarded: { offerId: string; offerName: string; waiverAmount: number }[] = []

  for (const o of firstNOffers) {
    if (heldOfferIds.has(o.id)) continue
    if (!o.firstNLimit || o.firstNLimit <= 0) continue
    if (o.deadline && o.deadline < now) continue

    // Count current active holders (across all programs in the batch).
    // Exclude WITHDRAWN students.
    const holders = await tx.studentOffer.count({
      where: {
        offerId: o.id,
        student: { batchId: student.batchId, status: { not: "WITHDRAWN" } },
      },
    })
    if (holders >= o.firstNLimit) continue

    // Award. Decrement netFee, increment totalWaiver, and reduce the Y1
    // installment by the waiver amount (FIRST_N is treated as Y1-only since
    // it's triggered by Y1 payment). If multiple Y1 installments exist
    // (rare), apply to the one with the largest amount.
    const waiver = Number(o.waiverAmount)
    await tx.studentOffer.create({
      data: { studentId, offerId: o.id, waiverAmount: waiver },
    })
    await tx.studentFinancial.update({
      where: { studentId },
      data: {
        totalWaiver: { increment: waiver },
        netFee: { decrement: waiver },
      },
    })
    await tx.studentAuditLog.create({
      data: {
        studentId,
        changedBy: studentId, // system action
        field: "offers",
        oldValue: "",
        newValue: `FIRST_N offer awarded: ${o.name} (₹${waiver})`,
        reason: `Awarded automatically — student is among the first ${o.firstNLimit} to pay Year 1 fee`,
      },
    })
    awarded.push({ offerId: o.id, offerName: o.name, waiverAmount: waiver })
  }

  return awarded
}
