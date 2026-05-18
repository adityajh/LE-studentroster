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
      batch: true,
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
