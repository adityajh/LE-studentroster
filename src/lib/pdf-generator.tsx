import { Document, Page, Text, View, StyleSheet, Font, Image, Link } from '@react-pdf/renderer'
import { formatINR } from './fee-schedule'
import { Prisma } from '@prisma/client'

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

// Register standard fonts
// Note: We use standard fonts to avoid Vercel 50MB edge limit issues with custom fonts in PDF generation
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKigQIvdW0g40.ttf' } // optional custom mapping if needed, else PDF viewer default is fine
  ]
})

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#160E44', // Deep Blue
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
    borderBottom: '2px solid #3663AD', // Enterprise Blue
    paddingBottom: 20,
  },
  logo: {
    width: 140,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3663AD',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#160E44',
    marginBottom: 10,
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
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
  divider: {
    borderBottom: '1px solid #e2e8f0',
    marginVertical: 10,
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#25BCBD', // Bright teal
  },
  table: {
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 10,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 5,
  },
  tableCol: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e2e8f0',
    padding: 5,
  },
  tableCellHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748b',
  },
  tableCell: {
    fontSize: 9,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 10,
  },
  termsContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  termsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#3663AD',
  },
  termsText: {
    fontSize: 8,
    color: '#475569',
  }
})

interface ProposalDocumentProps {
  student: FullStudent
  terms: string
}

export function ProposalDocument({ student, terms }: ProposalDocumentProps) {
  const fin = student.financial
  if (!fin) throw new Error("Financial records missing")

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>FEE PROPOSAL</Text>
          {/* We use a public URL or base64 for PDF renderer compatibility */}
          <View style={{ width: 140, height: 40, backgroundColor: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>[LE LOGO PLACEHOLDER]</Text>
          </View>
        </View>

        {/* Student Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{student.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Roll No:</Text>
            <Text style={styles.value}>{student.rollNo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Program:</Text>
            <Text style={styles.value}>{student.program.name} (Batch {student.batch.year})</Text>
          </View>
        </View>

        {/* Financial Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Breakdown</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>Base Program Fee:</Text>
            <Text style={styles.value}>{formatINR(fin.baseFee)}</Text>
          </View>

          {student.offers.map((so) => (
            <View key={so.id} style={styles.row}>
              <Text style={styles.label}>Offer: {so.offer.name}</Text>
              <Text style={{ ...styles.value, color: '#dc2626' }}>- {formatINR(so.waiverAmount)}</Text>
            </View>
          ))}

          {student.scholarships.map((ss) => (
            <View key={ss.id} style={styles.row}>
              <Text style={styles.label}>Scholarship: {ss.scholarship.name}</Text>
              <Text style={{ ...styles.value, color: '#dc2626' }}>- {formatINR(ss.amount)}</Text>
            </View>
          ))}

          {student.deductions.map((d) => (
            <View key={d.id} style={styles.row}>
              <Text style={styles.label}>Deduction: {d.description}</Text>
              <Text style={{ ...styles.value, color: '#dc2626' }}>- {formatINR(d.amount)}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Net Fee Payable:</Text>
            <Text style={{ ...styles.value, ...styles.grandTotal }}>{formatINR(fin.netFee)}</Text>
          </View>
        </View>

        {/* Payment Schedule Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Schedule ({fin.installmentType.replace('_', ' ')})</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>INSTALLMENT</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>YEAR</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>DUE DATE</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>AMOUNT</Text></View>
            </View>
            
            {student.installments.map((inst) => (
              <View style={styles.tableRow} key={inst.id}>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{inst.label}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{inst.year}</Text></View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>
                    {new Date(inst.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <View style={styles.tableCol}><Text style={{ ...styles.tableCell, fontWeight: 'bold' }}>{formatINR(inst.amount)}</Text></View>
              </View>
            ))}
          </View>
        </View>

        {/* Terms and Conditions */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          <Text style={styles.termsText}>{terms}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Let's Enterprise · Smart and Sleek Premium Education</Text>
          <Text>Generated on {new Date().toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' })} · Page 1 of 1</Text>
        </View>

      </Page>
    </Document>
  )
}
