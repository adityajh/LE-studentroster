/**
 * Shared loader for PDF appendix data — terms, programme expectations,
 * bank details, cash-free link. Used by every caller of ProposalDocument
 * so the four sections appear consistently across all fee-letter / proposal
 * PDFs (and the offer letter PDF, where applicable).
 *
 * Each field is optional in the return — falsy values are converted to
 * undefined so the PDF components can use `field ? <View> : null`.
 */
import { getSettings } from "@/app/actions/settings"

export type PdfAppendixData = {
  terms: string             // never empty — always falls back to a generic default
  programExpectations?: string
  bankDetails?: string
  cashFreeLink?: string
}

const DEFAULT_TERMS = "All fees must be paid on or before the due date."

export async function loadPdfAppendixData(opts?: { customTerms?: string | null }): Promise<PdfAppendixData> {
  const settings = await getSettings([
    "PROPOSAL_TERMS",
    "PROGRAM_EXPECTATIONS",
    "BANK_DETAILS",
    "CASH_FREE_LINK",
  ])

  return {
    terms: opts?.customTerms?.trim() || settings["PROPOSAL_TERMS"] || DEFAULT_TERMS,
    programExpectations: settings["PROGRAM_EXPECTATIONS"]?.trim() || undefined,
    bankDetails: settings["BANK_DETAILS"]?.trim() || undefined,
    cashFreeLink: settings["CASH_FREE_LINK"]?.trim() || undefined,
  }
}
