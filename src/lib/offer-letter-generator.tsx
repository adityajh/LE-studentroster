import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

export type OfferLetterData = {
  studentName: string
  programName: string
  batchYear: number
  offerExpiresAt: Date
  // Financial summary
  baseFee: number
  offers: { name: string; amount: number }[]
  scholarships: { name: string; amount: number }[]
  netFee: number
  // Configurable body text (from SystemSetting OFFER_LETTER_BODY)
  bodyText?: string
}

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    lineHeight: 1.6,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 28,
    borderBottomWidth: 2,
    borderBottomColor: "#3663AD",
    paddingBottom: 12,
  },
  logo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#3663AD",
    letterSpacing: 1,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 8,
    color: "#666",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 10,
    color: "#555",
    marginBottom: 20,
  },
  salutation: {
    fontSize: 10,
    marginBottom: 12,
  },
  body: {
    fontSize: 10,
    marginBottom: 10,
    lineHeight: 1.6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 6,
    color: "#3663AD",
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: {
    width: 14,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
  },
  feeBox: {
    backgroundColor: "#f4f7fc",
    borderRadius: 4,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 10,
  },
  feeRowBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    paddingTop: 5,
    marginTop: 5,
    fontSize: 10,
    fontWeight: "bold",
  },
  expiryBox: {
    borderWidth: 1,
    borderColor: "#e8a000",
    backgroundColor: "#fffbf0",
    borderRadius: 4,
    padding: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  expiryText: {
    fontSize: 10,
    color: "#7a4800",
  },
  footer: {
    marginTop: 28,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  footerText: {
    fontSize: 9,
    color: "#555",
    marginBottom: 3,
  },
  ack: {
    marginTop: 20,
    fontSize: 9,
    color: "#555",
    fontStyle: "italic",
  },
})

function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`
}

export function OfferLetterDocument({ data }: { data: OfferLetterData }) {
  const expiry = data.offerExpiresAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const defaultBody = `We are pleased to formally offer you admission to the ${data.programName} at Let's Enterprise for the ${data.batchYear} intake, commencing in August ${data.batchYear}, subject to the terms outlined below.

Based on your application, interactions, and assessment process, our admissions panel believes that you demonstrate the curiosity, intent, and growth mindset required to thrive in a highly experiential and non-traditional undergraduate journey.`

  const bodyText = data.bodyText || defaultBody

  const totalWaiver =
    data.offers.reduce((s, o) => s + o.amount, 0) +
    data.scholarships.reduce((s, sc) => s + sc.amount, 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>LET'S ENTERPRISE</Text>
          <Text style={styles.tagline}>www.letsenterprise.in  |  +91 84472 84008</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          Offer Letter — {data.programName} (Batch of {data.batchYear})
        </Text>
        <Text style={styles.subtitle}>
          This letter confirms your offer of admission. Please read carefully.
        </Text>

        {/* Salutation */}
        <Text style={styles.salutation}>Dear {data.studentName},</Text>

        {/* Body */}
        {bodyText.split("\n\n").map((para, i) => (
          <Text key={i} style={styles.body}>{para.trim()}</Text>
        ))}

        {/* About the Programme */}
        <Text style={styles.sectionTitle}>About {data.programName}</Text>
        {[
          "Entrepreneurial mindset and real-world employability skills",
          "Strong professional networks and proof-of-work portfolios",
          "Real-world and industry projects with mentored apprenticeships",
          "A BBA degree pathway aligned with the student's chosen university",
        ].map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}

        {/* Fee Summary */}
        <Text style={styles.sectionTitle}>Your Fee Summary</Text>
        <View style={styles.feeBox}>
          <View style={styles.feeRow}>
            <Text>Programme Fee</Text>
            <Text>{formatINR(data.baseFee)}</Text>
          </View>
          {data.offers.map((o, i) => (
            <View key={i} style={styles.feeRow}>
              <Text style={{ color: "#2a7a2a" }}>Less: {o.name}</Text>
              <Text style={{ color: "#2a7a2a" }}>- {formatINR(o.amount)}</Text>
            </View>
          ))}
          {data.scholarships.map((sc, i) => (
            <View key={i} style={styles.feeRow}>
              <Text style={{ color: "#2a7a2a" }}>Less: {sc.name} Scholarship</Text>
              <Text style={{ color: "#2a7a2a" }}>- {formatINR(sc.amount)}</Text>
            </View>
          ))}
          {totalWaiver > 0 && (
            <View style={styles.feeRow}>
              <Text style={{ color: "#2a7a2a", fontWeight: "bold" }}>Total Benefit</Text>
              <Text style={{ color: "#2a7a2a", fontWeight: "bold" }}>- {formatINR(totalWaiver)}</Text>
            </View>
          )}
          <View style={styles.feeRowBold}>
            <Text>Net Programme Fee</Text>
            <Text>{formatINR(data.netFee)}</Text>
          </View>
        </View>

        {/* Expiry notice */}
        <View style={styles.expiryBox}>
          <Text style={styles.expiryText}>
            ⏳  To secure your seat, please pay the ₹50,000 registration fee and confirm your admission by {expiry}.
            The 7-day confirmation waiver (if applicable) will lapse after this date.
          </Text>
        </View>

        {/* Programme Expectations */}
        <Text style={styles.sectionTitle}>Programme Expectations</Text>
        {[
          "Actively participate in all academic, project-based, and experiential components.",
          "Demonstrate ownership of your learning, professional conduct, and collaboration.",
          "Engage sincerely in real-world projects, apprenticeships, reviews, and feedback cycles.",
          "Adhere to Let's Enterprise's academic guidelines, attendance norms, and code of conduct.",
        ].map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>{i + 1}.</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Warm regards,</Text>
          <Text style={styles.footerText}>Admissions Team, Let's Enterprise</Text>
          <Text style={styles.footerText}>www.letsenterprise.in  |  +91 84472 84008</Text>
        </View>

        <Text style={styles.ack}>
          This letter serves as confirmation of your offer of admission to the {data.programName} (Batch of {data.batchYear}).
        </Text>
      </Page>
    </Document>
  )
}
