/**
 * Single source of truth for the OfferType enum.
 *
 * Used by:
 *   - New Fee Schedule form (offer type dropdown)
 *   - Edit Fee Schedule form (offer type dropdown)
 *   - Fee Schedule page legend at the bottom of the offers list
 *   - Offer-letter PDF builder (decides which types go in the "Conditional
 *     Offers" yellow box, and what condition text to attach)
 *   - Confirm-enrolment dialog (decides which offers are auto-checked at
 *     offer time, and which are auto-added when One-Time plan is chosen)
 *
 * The string values must match the Postgres `OfferType` enum exactly.
 */

export const OFFER_TYPES = [
  "DEADLINE",
  "ROLLING_DEADLINE",
  "FIRST_N",
  "FULL_PAYMENT",
  "REFERRAL",
  "REGULAR",
] as const

export type OfferTypeValue = (typeof OFFER_TYPES)[number]

export const OFFER_TYPE_LABELS: Record<OfferTypeValue, string> = {
  DEADLINE: "Deadline",
  ROLLING_DEADLINE: "Rolling Deadline",
  FIRST_N: "First N",
  FULL_PAYMENT: "Full Payment",
  REFERRAL: "Referral",
  REGULAR: "Regular",
}

export const OFFER_TYPE_DESCRIPTIONS: Record<OfferTypeValue, string> = {
  DEADLINE: "Applied if the student pays before a fixed calendar date (e.g. \"by 30 May 2026\"). Stops appearing in the offer letter the day after the deadline.",
  ROLLING_DEADLINE: "Applied if the student pays within a fixed number of days of receiving the offer letter (e.g. 7 days). Deadline is per-student, computed from offer date.",
  FIRST_N: "Applied to the first N students who register. Use the deadline field optionally for a hard time-cap.",
  FULL_PAYMENT: "Applied if the student chooses the One-Time (full 3-year upfront) payment plan. Auto-added in the Confirm Enrolment dialog when One-Time is selected.",
  REFERRAL: "Applied when the student refers another student who enrols in the program. Admin adds it once the referral has confirmed.",
  REGULAR: "No special behaviour. Always available; admin checks it manually in Step 1 if it applies.",
}

/** Types that should appear in the yellow "Conditional Offers" box on the
 *  offer-letter PDF appendix. REGULAR is excluded by design. */
export const CONDITIONAL_OFFER_TYPES: ReadonlySet<OfferTypeValue> = new Set([
  "DEADLINE",
  "ROLLING_DEADLINE",
  "FIRST_N",
  "FULL_PAYMENT",
  "REFERRAL",
])

/** Types auto-checked in Step 1 of the Confirm Enrolment dialog (the
 *  "default benefits"). The admin can uncheck if needed. */
export const AUTO_CHECK_OFFER_TYPES: ReadonlySet<OfferTypeValue> = new Set([
  "DEADLINE",
  "ROLLING_DEADLINE",
])

/** Whether the `deadline` field on the offer record is required, optional,
 *  or not applicable — used by the offer-edit forms to grey out / require
 *  the date input based on the selected type. */
export function deadlineApplicability(type: OfferTypeValue | string): "required" | "optional" | "none" {
  if (type === "DEADLINE") return "required"
  if (type === "FIRST_N") return "optional"
  return "none"
}

/** Generate the default human-readable description for an offer based on
 *  its type / deadline / firstNLimit. Used to pre-populate the description
 *  field in the offer form, and as the fallback display string when an
 *  admin hasn't entered one. */
export function defaultOfferDescription(opts: {
  type: OfferTypeValue | string
  deadline?: Date | string | null
  firstNLimit?: number | null
}): string {
  const { type, deadline, firstNLimit } = opts
  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

  switch (type) {
    case "DEADLINE":
      return deadline ? `Pay by ${fmtDate(deadline)}` : "Pay by the specified date"
    case "ROLLING_DEADLINE":
      return "Pay within 7 days of receiving the offer letter"
    case "FIRST_N":
      return firstNLimit && firstNLimit > 0
        ? `First ${firstNLimit} students to pay Year 1 fee`
        : "First N students to pay Year 1 fee"
    case "FULL_PAYMENT":
      return "Pay full 3-year fee upfront"
    case "REFERRAL":
      return "If you refer another student who enrols"
    case "REGULAR":
    default:
      return ""
  }
}
