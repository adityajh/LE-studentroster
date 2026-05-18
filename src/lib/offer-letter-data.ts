/**
 * Server-side helper that loads a student + settings and returns the data
 * payload expected by `OfferLetterDocument` (the @react-pdf renderer).
 *
 * Used by:
 *   - POST /api/students/[id]/send-offer  (renders → emails the PDF)
 *   - GET  /api/students/[id]/offer-letter (renders → returns the PDF inline
 *     for the "Preview PDF" button on the student detail page)
 *
 * The two endpoints MUST stay byte-identical on the PDF body — so they
 * both call this helper instead of duplicating the data plumbing.
 */

import { prisma } from "@/lib/prisma"
import { getSettings } from "@/app/actions/settings"
import type { OfferLetterData } from "@/lib/offer-letter-generator"
import fs from "fs"
import path from "path"

const DEFAULT_BANK_DETAILS = `Storysells Education Pvt. Ltd
Bank: ICICI Bank, Bund Garden Branch, Pune
Account No: 000505026869
IFSC: ICIC0000005`

export async function buildOfferLetterDataForStudent(
  studentId: string,
): Promise<{ data: OfferLetterData; student: { name: string; email: string | null; parent1Email: string | null; offerSentAt: Date | null; offerExpiresAt: Date | null; status: string } }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      program: true,
      batch: { include: { feeSchedule: { include: { offers: true } } } },
      financial: true,
      offers: { include: { offer: true } },
      scholarships: { include: { scholarship: true } },
      deductions: true,
      installments: { orderBy: { dueDate: "asc" } },
    },
  })

  if (!student) throw new Error("Student not found")

  const settings = await getSettings([
    "OFFER_LETTER_BODY",
    "BANK_DETAILS",
    "CASH_FREE_LINK",
    "PROPOSAL_TERMS",
    "PROGRAM_EXPECTATIONS",
  ])

  let logoSrc: string | undefined
  try {
    const logoBuf = fs.readFileSync(path.join(process.cwd(), "public", "le-logo-light.png"))
    logoSrc = `data:image/png;base64,${logoBuf.toString("base64")}`
  } catch { /* logo missing */ }

  const offerExpiresAt = student.offerExpiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const regFee = student.financial?.registrationFeeOverride != null
    ? Number(student.financial.registrationFeeOverride)
    : Number(student.program.registrationFee)

  // Build the explicit "Conditional Offers" list shown in the yellow box on
  // the appendix page. This is sourced from the batch's full offer catalogue
  // (not just what the student has confirmed) so that every conditional
  // discount available — 7-Day, Early Bird, Full 3-Year — is surfaced to
  // the student regardless of which ones we've pre-applied.
  const CONDITIONAL_TYPES = new Set(["EARLY_BIRD", "ACCEPTANCE_7DAY", "FULL_PAYMENT", "FIRST_N_REGISTRATIONS"])
  const batchOffers = student.batch.feeSchedule?.offers ?? []
  const conditionalOffers = batchOffers
    .filter((o) => CONDITIONAL_TYPES.has(o.type))
    .map((o) => {
      let deadline: Date | null | undefined = o.deadline
      let conditionText: string | undefined
      if (o.type === "ACCEPTANCE_7DAY") {
        // 7-Day offer's deadline is per-student: 7 days from offer date.
        deadline = offerExpiresAt
      } else if (o.type === "FULL_PAYMENT" && !o.deadline) {
        conditionText = "pay full 3-year fee upfront"
      } else if (o.type === "FIRST_N_REGISTRATIONS") {
        conditionText = "limited seats"
      }
      return { name: o.name, amount: Number(o.waiverAmount), deadline, conditionText }
    })

  const data: OfferLetterData = {
    studentName: student.name,
    programName: student.program.name,
    batchYear: student.batch.year,
    offerExpiresAt,
    registrationFee: regFee,
    baseFee: Number(student.financial?.baseFee ?? student.program.totalFee),
    year1Fee: Number(student.program.year1Fee),
    year2Fee: Number(student.program.year2Fee),
    year3Fee: Number(student.program.year3Fee),
    offers: student.offers.map((o) => ({
      name: o.offer.name,
      amount: Number(o.waiverAmount),
      deadline: o.offer.deadline,
    })),
    scholarships: student.scholarships.map((sc) => ({ name: sc.scholarship.name, amount: Number(sc.amount) })),
    conditionalOffers,
    netFee: Number(student.financial?.netFee ?? 0),
    bankDetails: settings["BANK_DETAILS"] || DEFAULT_BANK_DETAILS,
    cashFreeLink: settings["CASH_FREE_LINK"] || undefined,
    bodyText: settings["OFFER_LETTER_BODY"]
      ? settings["OFFER_LETTER_BODY"]
          .replace(/\{\{studentName\}\}/g, student.name)
          .replace(/\{\{programName\}\}/g, student.program.name)
          .replace(/\{\{batchYear\}\}/g, String(student.batch.year))
          .replace(/\{\{offerExpiryDate\}\}/g, offerExpiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))
      : undefined,
    terms: student.financial?.customTerms || settings["PROPOSAL_TERMS"] || undefined,
    programExpectations: settings["PROGRAM_EXPECTATIONS"] || undefined,
    logoSrc,
  }

  return {
    data,
    student: {
      name: student.name,
      email: student.email,
      parent1Email: student.parent1Email,
      offerSentAt: student.offerSentAt,
      offerExpiresAt: student.offerExpiresAt,
      status: student.status,
    },
  }
}
