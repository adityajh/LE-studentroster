import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// Helvetica is a react-pdf built-in font — no Font.register needed. The
// previous Font.register'd HelveticaNeue from Google Fonts was the cause of
// the broken ₹-as-superscript-"1" rendering and letter-spacing artefacts.
// Helvetica has no ₹ glyph either, so we use "Rs." as a prefix everywhere,
// matching how pdf-generator.tsx and offer-letter-generator.tsx handle it.
function formatPDFAmount(amount: number | { toNumber: () => number }): string {
  const num = typeof amount === "object" ? amount.toNumber() : Number(amount)
  return `Rs. ${Math.round(num).toLocaleString("en-IN")}`
}

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#160E44',
    lineHeight: 1.6,
  },
  header: {
    marginBottom: 40,
    borderBottom: '2px solid #3663AD',
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#3663AD',
    textTransform: 'uppercase',
  },
  receiptNo: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#160E44',
    marginBottom: 10,
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#64748b',
    width: '40%',
  },
  value: {
    fontFamily: 'Helvetica-Bold',
    width: '60%',
    textAlign: 'right',
  },
  amountContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
  },
  amountValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#25BCBD',
    letterSpacing: 0,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 60,
    right: 60,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 15,
  },
  stamp: {
    marginTop: 40,
    textAlign: 'right',
    fontSize: 9,
    color: '#64748b',
  }
})

interface ReceiptDocumentProps {
  student: {
    name: string
    rollNo: string | null
    program: { name: string }
    batch: { year: number }
  }
  payment: {
    id: string
    amount: number
    date: Date
    paymentMode: string | null
    referenceNo: string | null
    payerName: string | null
    installment?: { label: string } | null
    receiptNo?: string | null
  }
  /** From `computeFeeLedger(...).totals.fee` — includes registration. */
  totalFee: number
  /** From `computeFeeLedger(...).totals.received` — also includes the
   *  registration row when registration is a flag rather than a year=0
   *  installment. */
  totalReceived: number
  /** From `computeFeeLedger(...).outstanding`. */
  outstanding: number
}

export function ReceiptDocument({ student, payment, totalFee, totalReceived, outstanding }: ReceiptDocumentProps) {
  // Prefer the persisted receipt number; fall back to a derived value only
  // for backwards-compat with payments that were created before the column
  // existed (those have been backfilled, but belt-and-braces).
  const receiptNo = payment.receiptNo
    ?? `RCP-${student.rollNo ?? "PENDING"}-${payment.id.slice(-6).toUpperCase()}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Payment Receipt</Text>
            <Text style={styles.receiptNo}>{receiptNo}</Text>
          </View>
          <Text style={{ fontSize: 10, color: '#3663AD', fontFamily: 'Helvetica-Bold' }}>LET'S ENTERPRISE</Text>
        </View>

        {/* Amount Box */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Amount Received</Text>
          <Text style={styles.amountValue}>{formatPDFAmount(payment.amount)}</Text>
        </View>

        {/* Student Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Student Name:</Text>
            <Text style={styles.value}>{student.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Roll Number:</Text>
            <Text style={styles.value}>{student.rollNo ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Program:</Text>
            <Text style={styles.value}>{student.program.name} ({student.batch.year})</Text>
          </View>
        </View>

        {/* Payment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Date of Payment:</Text>
            <Text style={styles.value}>
              {new Date(payment.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Mode:</Text>
            <Text style={styles.value}>{payment.paymentMode || 'N/A'}</Text>
          </View>
          {payment.referenceNo && (
            <View style={styles.row}>
              <Text style={styles.label}>Reference / Trans. ID:</Text>
              <Text style={styles.value}>{payment.referenceNo}</Text>
            </View>
          )}
          {payment.payerName && (
            <View style={styles.row}>
              <Text style={styles.label}>Payer Name:</Text>
              <Text style={styles.value}>{payment.payerName}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>For Installment:</Text>
            <Text style={styles.value}>{payment.installment?.label || 'Advance Payment'}</Text>
          </View>
        </View>

        {/* Summary Section — totals come from computeFeeLedger so they
            include the registration fee and match the student detail UI. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Total Programme Fee (Net):</Text>
            <Text style={styles.value}>{formatPDFAmount(totalFee)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Amount Received To Date:</Text>
            <Text style={styles.value}>{formatPDFAmount(totalReceived)}</Text>
          </View>
          <View style={{ ...styles.row, marginTop: 5, borderTop: '1px solid #e2e8f0', paddingTop: 5 }}>
            <Text style={{ ...styles.label, fontFamily: 'Helvetica-Bold' }}>Outstanding Balance:</Text>
            <Text style={{ ...styles.value, color: outstanding > 0 ? '#334155' : '#25BCBD' }}>{formatPDFAmount(outstanding)}</Text>
          </View>
        </View>

        {/* Stamp / Signature Area */}
        <View style={styles.stamp}>
          <Text>Digitally Signed for Let's Enterprise</Text>
          <Text>On {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a system generated document and does not require a physical signature.</Text>
          <Text>Let's Enterprise · Smart and Sleek Premium Education</Text>
        </View>

      </Page>
    </Document>
  )
}
