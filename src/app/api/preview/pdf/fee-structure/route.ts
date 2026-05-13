import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { ProposalDocument } from "@/lib/pdf-generator"
import fs from "fs"
import path from "path"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let logoSrc: string | undefined
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", "le-logo-light.png"))
    logoSrc = `data:image/png;base64,${buf.toString("base64")}`
  } catch { /* logo missing */ }

  // Construct a mock student object that satisfies ProposalDocument's FullStudent type.
  // Decimal-typed fields are passed as numbers — ProposalDocument calls Number() on them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockStudent: any = {
    id: "preview",
    name: "Ananya Sharma",
    rollNo: "LE-25-001",
    email: "ananya@example.com",
    status: "ONBOARDING",
    program: {
      id: "prog-1",
      name: "LE UG-MED",
      registrationFee: 50000,
      year1Fee: 90000,
      year2Fee: 90000,
      year3Fee: 90000,
      totalFee: 320000,
      yearWiseDetails: null,
    },
    batch: { id: "batch-1", year: 2025, name: "Batch of 2025" },
    financial: {
      studentId: "preview",
      baseFee: 270000,
      netFee: 235000,
      totalWaiver: 35000,
      totalDeduction: 0,
      installmentType: "ANNUAL",
      registrationPaid: true,
      registrationPaidDate: new Date("2025-01-15"),
      registrationFeeOverride: null,
      isLocked: true,
      lockedAt: new Date("2025-01-15"),
      customTerms: null,
    },
    installments: [
      { id: "i0", studentId: "preview", year: 0, label: "Registration Fee", dueDate: new Date("2025-01-15"), amount: 50000, status: "PAID", paidDate: new Date("2025-01-15"), paidAmount: 50000, paymentMethod: "UPI", referenceNo: null },
      { id: "i1", studentId: "preview", year: 1, label: "Year 1 — Growth", dueDate: new Date("2025-08-07"), amount: 70000, status: "UPCOMING", paidDate: null, paidAmount: null, paymentMethod: null, referenceNo: null },
      { id: "i2", studentId: "preview", year: 2, label: "Year 2 — Projects", dueDate: new Date("2026-05-15"), amount: 90000, status: "UPCOMING", paidDate: null, paidAmount: null, paymentMethod: null, referenceNo: null },
      { id: "i3", studentId: "preview", year: 3, label: "Year 3 — Work", dueDate: new Date("2027-05-15"), amount: 75000, status: "UPCOMING", paidDate: null, paidAmount: null, paymentMethod: null, referenceNo: null },
    ],
    offers: [
      {
        id: "so1",
        studentId: "preview",
        offerId: "o1",
        waiverAmount: 20000,
        offer: { id: "o1", name: "Early Bird Discount", waiverAmount: 20000, deadline: null, conditions: "PERMANENT", type: "PERMANENT" },
      },
      {
        id: "so2",
        studentId: "preview",
        offerId: "o2",
        waiverAmount: 10000,
        offer: { id: "o2", name: "7-Day Confirmation Waiver", waiverAmount: 10000, deadline: new Date("2025-01-22"), conditions: "CONDITIONAL", type: "ACCEPTANCE_7DAY" },
      },
    ],
    scholarships: [
      {
        id: "ss1",
        studentId: "preview",
        scholarshipId: "sc1",
        amount: 15000,
        scholarship: { id: "sc1", name: "Merit Scholarship", spreadAcrossYears: false },
      },
    ],
    deductions: [],
  }

  const { loadPdfAppendixData } = await import("@/lib/pdf-appendix-data")
  const appendix = await loadPdfAppendixData()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(ProposalDocument, { student: mockStudent, ...appendix, logoSrc }) as any)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"sample-fee-structure.pdf\"",
    },
  })
}
