/**
 * Shared fee calculation helpers used across enroll, confirm-enrolment,
 * financial-plan PATCH, and the student detail page.
 *
 * Keep this file free of server-only imports so it can be used in
 * both server routes and client components.
 */

/**
 * Returns true if a waiver should be spread evenly across 3 programme years.
 * - For Offer: stored as `conditions.spreadAcrossYears`
 * - For Scholarship: stored as the top-level `spreadAcrossYears` field
 * Default (null / missing) is treated as spread = true.
 */
export const isSpreadCondition = (c: unknown): boolean =>
  c == null ||
  typeof c !== "object" ||
  (c as Record<string, unknown>).spreadAcrossYears !== false

/**
 * Split offer and scholarship waivers into per-year amounts so that
 * spreadY1 + spreadY2 + spreadY3 === total spread waiver exactly.
 * The 0–2 rupee rounding remainder is absorbed by Year 1 (then Year 2).
 *
 * - spreadY1/Y2/Y3: portion deducted from each programme year
 * - onetimeTotal:   portion deducted from Year 1 only
 * - spreadPerYear:  legacy field, equals floor(totalSpread / 3); prefer spreadYN
 */
export function splitWaivers(
  offers: { conditions: unknown; waiverAmount: number }[],
  scholarships: { amount: number; spreadAcrossYears: boolean }[]
): {
  spreadPerYear: number
  spreadY1: number
  spreadY2: number
  spreadY3: number
  onetimeTotal: number
} {
  const spreadOffer = offers
    .filter(o => isSpreadCondition(o.conditions))
    .reduce((s, o) => s + o.waiverAmount, 0)
  const onetimeOffer = offers
    .filter(o => !isSpreadCondition(o.conditions))
    .reduce((s, o) => s + o.waiverAmount, 0)

  const spreadSch = scholarships
    .filter(s => s.spreadAcrossYears !== false)
    .reduce((s, sc) => s + sc.amount, 0)
  const onetimeSch = scholarships
    .filter(s => s.spreadAcrossYears === false)
    .reduce((s, sc) => s + sc.amount, 0)

  const totalSpread = spreadOffer + spreadSch
  const base = Math.floor(totalSpread / 3)
  const rem = totalSpread - base * 3 // 0, 1, or 2

  return {
    spreadPerYear: base,
    spreadY1: base + (rem >= 1 ? 1 : 0),
    spreadY2: base + (rem >= 2 ? 1 : 0),
    spreadY3: base,
    onetimeTotal: onetimeOffer + onetimeSch,
  }
}

/**
 * Compute ANNUAL installment amounts for years 1–3 after applying waivers.
 * One-time waivers are fully deducted from Year 1; spread waivers are
 * divided across all three years with the rounding remainder absorbed
 * by Year 1 (then Year 2) so the per-year amounts sum exactly.
 */
export function annualInstallmentAmounts(
  yearFees: { y1: number; y2: number; y3: number },
  split: { spreadY1: number; spreadY2: number; spreadY3: number; onetimeTotal: number },
  deductionY1: number = 0
): { y1: number; y2: number; y3: number } {
  return {
    y1: Math.max(0, Math.round(yearFees.y1 - split.spreadY1 - split.onetimeTotal - deductionY1)),
    y2: Math.max(0, Math.round(yearFees.y2 - split.spreadY2)),
    y3: Math.max(0, Math.round(yearFees.y3 - split.spreadY3)),
  }
}
