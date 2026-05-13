import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"

export type OfferLetterData = {
  studentName: string
  programName: string
  batchYear: number
  offerExpiresAt: Date
  // Financial summary (page 1 fee box) — still needed for the appendix table
  registrationFee: number
  baseFee: number    // y1+y2+y3, excludes registration
  year1Fee: number
  year2Fee: number
  year3Fee: number
  offers: { name: string; amount: number; deadline?: Date | null }[]
  scholarships: { name: string; amount: number }[]
  netFee: number     // baseFee - waivers, excludes registration
  // Appendix
  bankDetails: string
  // Configurable body text (from SystemSetting OFFER_LETTER_BODY) — supports
  // **bold headings**, bullet lines (- or •), and numbered lines (1. 2. …)
  bodyText?: string
  // Final-page appendix content (from SystemSetting PROPOSAL_TERMS + PROGRAM_EXPECTATIONS)
  terms?: string
  programExpectations?: string
  // Logo (base64 data URI passed from server route)
  logoSrc?: string
}

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    lineHeight: 1.6,
    color: "#1e293b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 28,
    borderBottomWidth: 2,
    borderBottomColor: "#3663AD",
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: "column",
  },
  logo: {
    width: 160,
    height: 44,
    objectFit: "contain",
  },
  logoFallback: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#3663AD",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 3,
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  contact: {
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "right",
    lineHeight: 1.6,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    color: "#1e293b",
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
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
    fontFamily: "Helvetica-Bold",
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
    marginBottom: 4,
    fontSize: 10,
  },
  feeAmount: {
    fontSize: 10,
    letterSpacing: 0,
  },
  feeDeductLabel: {
    fontSize: 10,
    color: "#475569",
  },
  feeDeductAmount: {
    fontSize: 10,
    color: "#475569",
    letterSpacing: 0,
  },
  feeRowBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#c8d6e8",
    paddingTop: 6,
    marginTop: 6,
    fontSize: 10,
  },
  feeRowBoldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  feeRowBoldAmount: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#3663AD",
    letterSpacing: 0,
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
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  footerText: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 2,
  },
  footerAddress: {
    fontSize: 8,
    color: "#94a3b8",
    marginTop: 4,
  },
  ack: {
    marginTop: 16,
    fontSize: 9,
    color: "#64748b",
    fontFamily: "Helvetica-Oblique",
  },
  // ── Appendix styles ───────────────────────────────────────────────────────
  appendixLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  appendixTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#3663AD",
    paddingBottom: 8,
  },
  appSection: {
    marginBottom: 20,
  },
  appSectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 4,
  },
  appRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  appLabel: {
    fontSize: 10,
    color: "#64748b",
    width: "55%",
  },
  appValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    width: "45%",
    textAlign: "right",
    letterSpacing: 0,
  },
  appDeductValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    width: "45%",
    textAlign: "right",
    letterSpacing: 0,
  },
  appDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginVertical: 6,
  },
  appTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  appTotalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
  },
  appTotalValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#3663AD",
    letterSpacing: 0,
  },
  conditionalBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  conditionalTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#92400e",
    marginBottom: 6,
  },
  conditionalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  conditionalLabel: {
    fontSize: 10,
    color: "#78350f",
    width: "55%",
  },
  conditionalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#78350f",
    width: "45%",
    textAlign: "right",
    letterSpacing: 0,
  },
  conditionalNote: {
    fontSize: 8,
    color: "#92400e",
    marginTop: 6,
    lineHeight: 1.5,
  },
  bankBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bankText: {
    fontSize: 10,
    color: "#334155",
    lineHeight: 1.7,
  },
})

// PDF-safe formatter: Helvetica has no ₹ glyph — use "Rs." instead.
function formatINR(amount: number) {
  return `Rs. ${amount.toLocaleString("en-IN")}`
}

// Light markup parser for admin-edited body text. Supports:
//   **Heading**      → bold heading block
//   - item / • item  → bullet
//   1. item          → numbered (rendered as written)
//   blank line       → paragraph break
//   anything else    → normal paragraph
function renderRichBody(text: string) {
  const blocks: React.ReactNode[] = []
  // Normalize: collapse runs of empty lines and trim trailing whitespace
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  let key = 0
  let bulletGroup: { kind: "bullet" | "number"; items: { marker: string; text: string }[] } | null = null

  const flushBulletGroup = () => {
    if (bulletGroup && bulletGroup.items.length > 0) {
      blocks.push(
        <View key={`bg-${key++}`} style={{ marginBottom: 8 }}>
          {bulletGroup.items.map((it, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>{it.marker}</Text>
              <Text style={styles.bulletText}>{it.text}</Text>
            </View>
          ))}
        </View>
      )
    }
    bulletGroup = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line === "") {
      flushBulletGroup()
      continue
    }
    // Bold heading: **text**
    const bold = line.match(/^\*\*\s*(.+?)\s*\*\*\s*:?$/)
    if (bold) {
      flushBulletGroup()
      blocks.push(<Text key={`h-${key++}`} style={styles.sectionTitle}>{bold[1]}</Text>)
      continue
    }
    // Bullet
    const bul = line.match(/^[•\-]\s+(.+)$/)
    if (bul) {
      if (!bulletGroup || bulletGroup.kind !== "bullet") {
        flushBulletGroup()
        bulletGroup = { kind: "bullet", items: [] }
      }
      bulletGroup.items.push({ marker: "•", text: bul[1] })
      continue
    }
    // Numbered
    const num = line.match(/^(\d+)\.\s+(.+)$/)
    if (num) {
      if (!bulletGroup || bulletGroup.kind !== "number") {
        flushBulletGroup()
        bulletGroup = { kind: "number", items: [] }
      }
      bulletGroup.items.push({ marker: `${num[1]}.`, text: num[2] })
      continue
    }
    // Regular paragraph line
    flushBulletGroup()
    blocks.push(<Text key={`p-${key++}`} style={styles.body}>{line}</Text>)
  }
  flushBulletGroup()
  return blocks
}

export function OfferLetterDocument({ data }: { data: OfferLetterData }) {
  const expiry = data.offerExpiresAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const defaultBody = `Dear ${data.studentName},

We are pleased to formally offer you admission to the ${data.programName} at Let's Enterprise for the ${data.batchYear} intake, commencing in August ${data.batchYear}, subject to the terms outlined below.

Based on your application, interactions, and assessment process, our admissions panel believes that you demonstrate the curiosity, intent, and growth mindset required to thrive in a highly experiential and non-traditional undergraduate journey.

**About the Programme**

The ${data.programName} is a three-year, multidisciplinary, experiential undergraduate programme designed to help young people build:
- Entrepreneurial mindset
- Real-world employability skills
- Strong professional networks
- Proof-of-work portfolios

The programme emphasises applied learning through real projects, mentored apprenticeships, coaching, and immersive field experiences. Students build demonstrable skills, a strong body of work, and professional clarity alongside their academic journey.

**All students experience**

- Real-world and industry projects
- Mentored apprenticeships with startups and SMEs
- Continuous coaching and founder mentorship
- A BBA degree pathway aligned with the student's chosen university`

  const bodyText = data.bodyText || defaultBody

  const permanentOffers = data.offers.filter((o) => !o.deadline)
  const conditionalOffers = data.offers.filter((o) => !!o.deadline)

  const programTotal = data.registrationFee + data.baseFee
  const netTotal = data.registrationFee + data.netFee

  return (
    <Document>
      {/* ── Page 1: Offer Letter ── */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {data.logoSrc ? (
              <Image src={data.logoSrc} style={styles.logo} />
            ) : (
              <Text style={styles.logoFallback}>LET'S ENTERPRISE</Text>
            )}
            <Text style={styles.tagline}>Work is the Curriculum</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.contact}>www.letsenterprise.in</Text>
            <Text style={styles.contact}>+91 84472 84008</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          Offer Letter — {data.programName} (Batch of {data.batchYear})
        </Text>
        <Text style={styles.subtitle}>
          This letter confirms your offer of admission. Please read carefully.
        </Text>

        {/* Body — rich content from OFFER_LETTER_BODY (supports **headings**,
            bullets `-` / `•`, and `1.` numbered lists). The salutation is
            expected to be the first line of the body. */}
        {renderRichBody(bodyText)}

        {/* Expiry notice */}
        <View style={styles.expiryBox}>
          <Text style={styles.expiryText}>
            To secure your seat, please pay the Rs. 50,000 registration fee and confirm your admission by {expiry}.
            The 7-day confirmation waiver (if applicable) will lapse after this date.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Warm regards,</Text>
          <Text style={styles.footerText}>Admissions Team, Let's Enterprise</Text>
          <Text style={styles.footerAddress}>
            6th Floor, Trimurty Honeygold, 44 Range Hill Road, Sinchan Nagar, Ashok Nagar, Pune, Maharashtra 411016
          </Text>
          <Text style={styles.footerAddress}>
            www.letsenterprise.in  ·  +91 84472 84008
          </Text>
        </View>

        <Text style={styles.ack}>
          This letter serves as confirmation of your offer of admission to the {data.programName} (Batch of {data.batchYear}).
        </Text>
      </Page>

      {/* ── Page 2: Appendix — Fee Breakdown & Payment Details ── */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {data.logoSrc ? (
              <Image src={data.logoSrc} style={styles.logo} />
            ) : (
              <Text style={styles.logoFallback}>LET'S ENTERPRISE</Text>
            )}
            <Text style={styles.tagline}>Work is the Curriculum</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.contact}>www.letsenterprise.in</Text>
            <Text style={styles.contact}>+91 84472 84008</Text>
          </View>
        </View>

        <Text style={styles.appendixLabel}>Appendix</Text>
        <Text style={styles.appendixTitle}>Fee Breakdown & Payment Details</Text>

        {/* Year-by-year fee table */}
        <View style={styles.appSection}>
          <Text style={styles.appSectionTitle}>Fee Structure</Text>

          <View style={styles.appRow}>
            <Text style={styles.appLabel}>Registration Fee</Text>
            <Text style={styles.appValue}>{formatINR(data.registrationFee)}</Text>
          </View>
          <View style={styles.appRow}>
            <Text style={styles.appLabel}>Year 1 — Growth</Text>
            <Text style={styles.appValue}>{formatINR(data.year1Fee)}</Text>
          </View>
          <View style={styles.appRow}>
            <Text style={styles.appLabel}>Year 2 — Projects</Text>
            <Text style={styles.appValue}>{formatINR(data.year2Fee)}</Text>
          </View>
          <View style={styles.appRow}>
            <Text style={styles.appLabel}>Year 3 — Work</Text>
            <Text style={styles.appValue}>{formatINR(data.year3Fee)}</Text>
          </View>

          <View style={styles.appDivider} />

          <View style={styles.appRow}>
            <Text style={[styles.appLabel, { fontFamily: "Helvetica-Bold", color: "#1e293b" }]}>Total Programme Fee</Text>
            <Text style={[styles.appValue, { color: "#1e293b" }]}>{formatINR(programTotal)}</Text>
          </View>
        </View>

        {/* Confirmed Benefits */}
        {(permanentOffers.length > 0 || data.scholarships.length > 0) && (
          <View style={styles.appSection}>
            <Text style={styles.appSectionTitle}>Confirmed Benefits</Text>

            {permanentOffers.map((o, i) => (
              <View key={i} style={styles.appRow}>
                <Text style={styles.appLabel}>{o.name}</Text>
                <Text style={styles.appDeductValue}>- {formatINR(o.amount)}</Text>
              </View>
            ))}
            {data.scholarships.map((sc, i) => (
              <View key={i} style={styles.appRow}>
                <Text style={styles.appLabel}>{sc.name} Scholarship</Text>
                <Text style={styles.appDeductValue}>- {formatINR(sc.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Net Fee Payable — always shown */}
        <View style={styles.appDivider} />
        <View style={styles.appTotalRow}>
          <Text style={styles.appTotalLabel}>Net Fee Payable</Text>
          <Text style={styles.appTotalValue}>{formatINR(netTotal)}</Text>
        </View>

        {/* Conditional / time-gated offers */}
        {conditionalOffers.length > 0 && (
          <View style={styles.conditionalBox}>
            <Text style={styles.conditionalTitle}>
              Conditional Offers (applied on confirmation before deadline)
            </Text>
            {conditionalOffers.map((o, i) => (
              <View key={i} style={styles.conditionalRow}>
                <Text style={styles.conditionalLabel}>{o.name}</Text>
                <Text style={styles.conditionalValue}>
                  - {formatINR(o.amount)}
                  {o.deadline
                    ? `  (by ${new Date(o.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})`
                    : ""}
                </Text>
              </View>
            ))}
            <Text style={styles.conditionalNote}>
              Note: The above offer(s) will be applied to your programme fee upon confirmation of admission and payment of the registration fee, provided the deadline has not passed.
            </Text>
          </View>
        )}

        {/* Bank Details */}
        <View style={[styles.appSection, { marginTop: 24 }]}>
          <Text style={styles.appSectionTitle}>Payment — Bank Details</Text>
          <View style={styles.bankBox}>
            <Text style={styles.bankText}>{data.bankDetails}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerAddress}>
            Let's Enterprise  ·  6th Floor, Trimurty Honeygold, 44 Range Hill Road, Pune 411016
          </Text>
          <Text style={styles.footerAddress}>
            www.letsenterprise.in  ·  +91 84472 84008
          </Text>
        </View>
      </Page>

      {/* ── Page 3: Appendix — Terms & Conditions + Programme Expectations ── */}
      {(data.terms || data.programExpectations) && (
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {data.logoSrc ? (
                <Image src={data.logoSrc} style={styles.logo} />
              ) : (
                <Text style={styles.logoFallback}>LET'S ENTERPRISE</Text>
              )}
              <Text style={styles.tagline}>Work is the Curriculum</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.contact}>www.letsenterprise.in</Text>
              <Text style={styles.contact}>+91 84472 84008</Text>
            </View>
          </View>

          <Text style={styles.appendixLabel}>Appendix</Text>
          <Text style={styles.appendixTitle}>Terms &amp; Programme Expectations</Text>

          {data.terms ? (
            <View style={styles.appSection}>
              <Text style={styles.appSectionTitle}>Terms &amp; Conditions</Text>
              {renderRichBody(data.terms)}
            </View>
          ) : null}

          {data.programExpectations ? (
            <View style={styles.appSection}>
              <Text style={styles.appSectionTitle}>Programme Expectations</Text>
              {renderRichBody(data.programExpectations)}
            </View>
          ) : null}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerAddress}>
              Let's Enterprise  ·  6th Floor, Trimurty Honeygold, 44 Range Hill Road, Pune 411016
            </Text>
            <Text style={styles.footerAddress}>
              www.letsenterprise.in  ·  +91 84472 84008
            </Text>
          </View>
        </Page>
      )}
    </Document>
  )
}
