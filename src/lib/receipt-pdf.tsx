import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { formatINR } from './fee-schedule'

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKigQIvdW0g40.ttf' }
  ]
})

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
    fontWeight: 'bold',
    color: '#3663AD',
    textTransform: 'uppercase',
  },
  receiptNo: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#64748b',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: '#64748b',
  },
  amountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#25BCBD',
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
    rollNo: string
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
  }
  netFee: number
  totalPaid: number
}

export function ReceiptDocument({ student, payment, netFee, totalPaid }: ReceiptDocumentProps) {
  const receiptNo = `RCP-${student.rollNo}-${payment.id.slice(-6).toUpperCase()}`
  const balance = Math.max(0, netFee - totalPaid)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PAYMENT RECEIPT</Text>
            <Text style={styles.receiptNo}>{receiptNo}</Text>
          </View>
          <Text style={{ fontSize: 10, color: '#3663AD', fontWeight: 'bold' }}>LET'S ENTERPRISE</Text>
        </View>

        {/* Amount Box */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Amount Received</Text>
          <Text style={styles.amountValue}>{formatINR(payment.amount)}</Text>
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
            <Text style={styles.value}>{student.rollNo}</Text>
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

        {/* Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Total Program Fee (Net):</Text>
            <Text style={styles.value}>{formatINR(netFee)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Amount Received To Date:</Text>
            <Text style={styles.value}>{formatINR(totalPaid)}</Text>
          </View>
          <View style={{ ...styles.row, marginTop: 5, borderTop: '1px solid #e2e8f0', paddingTop: 5 }}>
            <Text style={{ ...styles.label, fontWeight: 'bold' }}>Outstanding Balance:</Text>
            <Text style={{ ...styles.value, color: balance > 0 ? '#334155' : '#25BCBD' }}>{formatINR(balance)}</Text>
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
