import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { ReceiptDocument } from "@/lib/receipt-pdf"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(ReceiptDocument, {
      student: {
        name: "Ananya Sharma",
        rollNo: "LE-25-001",
        program: { name: "LE UG-MED" },
        batch: { year: 2025 },
      },
      payment: {
        id: "abcdef123456",
        amount: 50000,
        date: new Date("2025-01-15"),
        paymentMode: "UPI",
        referenceNo: "UPI2025011512345",
        payerName: "Ramesh Sharma",
        installment: { label: "Registration Fee" },
      },
      netFee: 235000,
      totalPaid: 50000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"sample-receipt.pdf\"",
    },
  })
}
