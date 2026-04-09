import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, Packer, AlignmentType } from "docx"
import { formatINR } from "./fee-schedule"
import { Prisma } from "@prisma/client"

type FullStudent = Prisma.StudentGetPayload<{
  include: {
    program: true
    batch: true
    financial: true
    installments: { orderBy: { dueDate: "asc" } }
    offers: { include: { offer: true } }
    scholarships: { include: { scholarship: true } }
    deductions: true
  }
}>

export async function generateDocxProposal(student: FullStudent, terms: string): Promise<Buffer> {
  const fin = student.financial
  if (!fin) throw new Error("Financial records missing")

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "FEE PROPOSAL",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: `Date: ${new Date().toLocaleDateString("en-IN")}`,
          alignment: AlignmentType.RIGHT,
        }),
        new Paragraph({ text: "" }), // spacing
        
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Student Details")],
        }),
        new Paragraph({ text: `Name: ${student.name}` }),
        new Paragraph({ text: `Roll No: ${student.rollNo}` }),
        new Paragraph({ text: `Program: ${student.program.name} (Batch ${student.batch.year})` }),
        
        new Paragraph({ text: "" }),
        
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Financial Breakdown")],
        }),
        new Paragraph({ text: `Base Program Fee: ${formatINR(fin.baseFee)}` }),
        ...student.offers.map(o => new Paragraph({ text: `Offer (${o.offer.name}): -${formatINR(o.waiverAmount)}` })),
        ...student.scholarships.map(s => new Paragraph({ text: `Scholarship (${s.scholarship.name}): -${formatINR(s.amount)}` })),
        ...student.deductions.map(d => new Paragraph({ text: `Deduction (${d.description}): -${formatINR(d.amount)}` })),
        new Paragraph({ text: `Net Fee Payable: ${formatINR(fin.netFee)}`, heading: HeadingLevel.HEADING_3 }),

        new Paragraph({ text: "" }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun(`Payment Schedule (${fin.installmentType.replace('_', ' ')})`)],
        }),
        
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("INSTALLMENT")] }),
                new TableCell({ children: [new Paragraph("YEAR")] }),
                new TableCell({ children: [new Paragraph("DUE DATE")] }),
                new TableCell({ children: [new Paragraph("AMOUNT")] }),
              ]
            }),
            ...student.installments.map(inst => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(inst.label)] }),
                new TableCell({ children: [new Paragraph(inst.year.toString())] }),
                new TableCell({ children: [new Paragraph(new Date(inst.dueDate).toLocaleDateString("en-IN"))] }),
                new TableCell({ children: [new Paragraph(formatINR(inst.amount))] }),
              ]
            }))
          ]
        }),

        new Paragraph({ text: "" }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Terms & Conditions")],
        }),
        ...terms.split('\n').map(line => new Paragraph({ text: line }))
      ],
    }],
  })

  // Convert to buffer
  return await Packer.toBuffer(doc)
}
