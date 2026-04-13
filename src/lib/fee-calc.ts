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
 * Split offer and scholarship waivers into:
 * - spreadPerYear: portion deducted from each of the 3 programme years
 * - onetimeTotal:  portion deducted from Year 1 only
 */
export function splitWaivers(
  offers: { conditions: unknown; waiverAmount: number }[],
  scholarships: { amount: number; spreadAcrossYears: boolean }[]
): { spreadPerYear: number; onetimeTotal: number } {
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

  return {
    spreadPerYear: Math.round((spreadOffer + spreadSch) / 3),
    onetimeTotal: onetimeOffer + onetimeSch,
  }
}

/**
 * Compute ANNUAL installment amounts for years 1–3 after applying waivers.
 * One-time waivers are fully deducted from Year 1; spread waivers are
 * divided evenly across all three years.
 */
export function annualInstallmentAmounts(
  yearFees: { y1: number; y2: number; y3: number },
  spreadPerYear: number,
  onetimeTotal: number
): { y1: number; y2: number; y3: number } {
  return {
    y1: Math.max(0, Math.round(yearFees.y1 - spreadPerYear - onetimeTotal)),
    y2: Math.max(0, Math.round(yearFees.y2 - spreadPerYear)),
    y3: Math.max(0, Math.round(yearFees.y3 - spreadPerYear)),
  }
}
