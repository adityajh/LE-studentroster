import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { Prisma } from '@prisma/client'

// PDF-safe formatter: Helvetica has no ₹ glyph — use "Rs." instead.
// Also uses full amounts (no L/K shorthand) for formal documents.
function formatPDFAmount(amount: number | string | { toNumber: () => number }): string {
  const num = typeof amount === "object" && "toNumber" in amount ? amount.toNumber() : Number(amount)
  return `Rs. ${num.toLocaleString("en-IN")}`
}

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

// Helvetica is a react-pdf built-in font — no Font.register needed.

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 32,
    borderBottomWidth: 2,
    borderBottomColor: '#3663AD',
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 4,
  },
  logo: {
    width: 160,
    height: 44,
    objectFit: 'contain',
  },
  logoFallback: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#3663AD',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 3,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#3663AD',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  docSubtitle: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    color: '#64748b',
    width: '55%',
  },
  value: {
    fontFamily: 'Helvetica-Bold',
    width: '45%',
    textAlign: 'right',
    letterSpacing: 0,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginVertical: 8,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  grandTotalValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#3663AD',
    letterSpacing: 0,
  },
  deductionValue: {
    fontFamily: 'Helvetica-Bold',
    width: '45%',
    textAlign: 'right',
    color: '#475569',
    letterSpacing: 0,
  },
  table: {
    width: 'auto',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 8,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '25%',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    padding: 6,
  },
  tableCol: {
    width: '25%',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
  },
  tableCellHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    letterSpacing: 0,
  },
  tableCell: {
    fontSize: 9,
    letterSpacing: 0,
  },
  tableCellAmount: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0,
  },
  emptyTableRow: {
    padding: 12,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
  },
  emptyTableText: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Helvetica-Oblique',
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 2,
  },
  termsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  termsTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#3663AD',
  },
  termsText: {
    fontSize: 8,
    color: '#475569',
    lineHeight: 1.5,
  },
})

interface ProposalDocumentProps {
  student: FullStudent
  terms: string
  logoSrc?: string
}

export function ProposalDocument({ student, terms, logoSrc }: ProposalDocumentProps) {
  const fin = student.financial
  if (!fin) throw new Error("Financial records missing")

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoSrc ? (
              <Image src={logoSrc} style={styles.logo} />
            ) : (
              <Text style={styles.logoFallback}>LET'S ENTERPRISE</Text>
            )}
            <Text style={styles.tagline}>Work is the Curriculum</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>Fee Proposal</Text>
            <Text style={styles.docSubtitle}>
              Generated {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </Text>
          </View>
        </View>

        {/* Student Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{student.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Roll No</Text>
            <Text style={styles.value}>{student.rollNo ?? "Pending Enrolment"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Programme</Text>
            <Text style={styles.value}>{student.program.name} — Batch {student.batch.year}</Text>
          </View>
        </View>

        {/* Financial Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Breakdown</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Base Programme Fee</Text>
            <Text style={styles.value}>{formatPDFAmount(fin.baseFee)}</Text>
          </View>

          {student.offers.map((so) => (
            <View key={so.id} style={styles.row}>
              <Text style={styles.label}>Offer: {so.offer.name}</Text>
              <Text style={styles.deductionValue}>- {formatPDFAmount(so.waiverAmount)}</Text>
            </View>
          ))}

          {student.scholarships.map((ss) => (
            <View key={ss.id} style={styles.row}>
              <Text style={styles.label}>Scholarship: {ss.scholarship.name}</Text>
              <Text style={styles.deductionValue}>- {formatPDFAmount(ss.amount)}</Text>
            </View>
          ))}

          {student.deductions.map((d) => (
            <View key={d.id} style={styles.row}>
              <Text style={styles.label}>Deduction: {d.description}</Text>
              <Text style={styles.deductionValue}>- {formatPDFAmount(d.amount)}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Net Fee Payable</Text>
            <Text style={styles.grandTotalValue}>{formatPDFAmount(fin.netFee)}</Text>
          </View>
        </View>

        {/* Payment Schedule Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Payment Schedule ({fin.installmentType.replace('_', ' ')})
          </Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>INSTALLMENT</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>YEAR</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>DUE DATE</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>AMOUNT</Text></View>
            </View>

            {student.installments.length > 0 ? (
              student.installments.map((inst) => (
                <View style={styles.tableRow} key={inst.id}>
                  <View style={styles.tableCol}><Text style={styles.tableCell}>{inst.label}</Text></View>
                  <View style={styles.tableCol}><Text style={styles.tableCell}>{inst.year}</Text></View>
                  <View style={styles.tableCol}>
                    <Text style={styles.tableCell}>
                      {new Date(inst.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                  </View>
                  <View style={styles.tableCol}><Text style={styles.tableCellAmount}>{formatPDFAmount(inst.amount)}</Text></View>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <View style={[styles.emptyTableRow, { width: '100%' }]}>
                  <Text style={styles.emptyTableText}>
                    Schedule will be finalised upon confirmation of enrolment.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Terms and Conditions */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          <Text style={styles.termsText}>{terms}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Let's Enterprise · 6th Floor, Trimurty Honeygold, 44 Range Hill Road, Sinchan Nagar, Ashok Nagar, Pune 411016
          </Text>
          <Text style={styles.footerText}>
            www.letsenterprise.in  ·  +91 84472 84008
          </Text>
        </View>

      </Page>
    </Document>
  )
}
