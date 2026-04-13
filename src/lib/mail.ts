import nodemailer from "nodemailer"
import { prisma } from "./prisma"

// ── Reminder email config ─────────────────────────────────────────────────────
//
// Priority order for SMTP credentials:
//   1. SystemSetting in DB (set via /settings → Email tab)
//   2. Environment variables (REMINDER_GMAIL_USER / REMINDER_GMAIL_APP_PASSWORD)
//
// SystemSetting keys used:
//   SMTP_USER         — Gmail address to send from
//   SMTP_PASSWORD     — Gmail App Password
//   SMTP_FROM_NAME    — Display name, e.g. "Let's Enterprise Fees"
//   SMTP_FROM_EMAIL   — Override "from" address (defaults to SMTP_USER)

export type ReminderEmailPayload = {
  to: string
  studentName: string
  installmentLabel: string
  amount: number
  dueDate: Date
  reminderType: "ONE_MONTH" | "ONE_WEEK" | "DUE_DATE"
  bodyText: string
  paymentInstructions?: string
  logId?: string
}

type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string }
  | { ok: false; skipped: true; reason: string }

type SmtpConfig = {
  user: string
  pass: string
  fromName: string
  fromEmail: string
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  // Fetch all four keys in one query
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_NAME", "SMTP_FROM_EMAIL"] } },
  })
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value

  // DB config takes priority; fall back to env vars
  const user = map["SMTP_USER"] || process.env.REMINDER_GMAIL_USER || ""
  const pass = map["SMTP_PASSWORD"] || process.env.REMINDER_GMAIL_APP_PASSWORD || ""

  if (!user || !pass) return null

  const fromName = map["SMTP_FROM_NAME"] || "Let's Enterprise"
  const fromEmail = map["SMTP_FROM_EMAIL"] || user

  return { user, pass, fromName, fromEmail }
}

function createTransporter(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: { user: config.user, pass: config.pass },
  })
}

function reminderSubject(type: ReminderEmailPayload["reminderType"], label: string) {
  switch (type) {
    case "ONE_MONTH": return `Fee Reminder — ${label} due in 1 month`
    case "ONE_WEEK":  return `Fee Reminder — ${label} due in 1 week`
    case "DUE_DATE":  return `Payment Due Today — ${label}`
  }
}

function reminderHtml(payload: ReminderEmailPayload) {
  const { studentName, installmentLabel, amount, dueDate, bodyText, paymentInstructions, logId } = payload

  const formattedDate = dueDate.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(amount)

  const trackingPixel = logId
    ? `<img src="${process.env.NEXT_PUBLIC_APP_URL}/api/reminders/track/${logId}" width="1" height="1" style="display:none;opacity:0;border:0;outline:none;" />`
    : ""

  // Safely inject text and convert newlines to <br/>
  const htmlMessage = bodyText
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{{studentName}}/g, studentName)
    .replace(/{{installmentLabel}}/g, installmentLabel)
    .replace(/{{dueDate}}/g, formattedDate)
    .replace(/{{amount}}/g, formattedAmount)
    .replace(/\n/g, "<br/>")

  const pmInstructions = paymentInstructions
    ? `<p style="margin-top:20px; font-weight:bold;">Payment Instructions:</p><p>${paymentInstructions.replace(/\n/g, "<br/>")}</p>`
    : ""

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;font-size:15px;line-height:1.6;background:#ffffff;">
  ${EMAIL_HEADER}
  <div>
    ${htmlMessage}
    ${pmInstructions}
  </div>
  ${EMAIL_FOOTER}
  ${trackingPixel}
</body>
</html>
`
}

export async function sendFeeReminder(payload: ReminderEmailPayload): Promise<SendResult> {
  if (!payload.to) {
    return { ok: false, skipped: true, reason: "Student has no email address" }
  }

  const config = await getSmtpConfig()

  if (!config) {
    return {
      ok: false,
      skipped: true,
      reason: "SMTP not configured. Set SMTP_USER and SMTP_PASSWORD in Settings → Email, or via environment variables.",
    }
  }

  const transporter = createTransporter(config)
  const from = `${config.fromName} <${config.fromEmail}>`

  try {
    const info = await transporter.sendMail({
      from,
      to: payload.to,
      subject: reminderSubject(payload.reminderType, payload.installmentLabel),
      html: reminderHtml(payload),
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export type ReceiptEmailPayload = {
  to: string[]
  cc?: string[]
  studentName: string
  amount: number
  paymentDate: Date
  paymentMode: string
  installmentLabel: string
  receiptNo: string
  pdfBuffer: Buffer
}

export async function sendReceiptEmail(payload: ReceiptEmailPayload): Promise<SendResult> {
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)
  const from = `${config.fromName} <${config.fromEmail}>`

  const formattedDate = payload.paymentDate.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(payload.amount)

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;font-size:15px;line-height:1.6;background:#fff;">
  ${EMAIL_HEADER}
  <p>Dear ${payload.studentName},</p>
  <p>This is to confirm that we have received your payment of <strong>${formattedAmount}</strong> on ${formattedDate}.</p>
  <p><strong>Payment Details:</strong></p>
  <ul>
    <li><strong>Receipt No:</strong> ${payload.receiptNo}</li>
    <li><strong>Mode:</strong> ${payload.paymentMode}</li>
    <li><strong>For:</strong> ${payload.installmentLabel}</li>
  </ul>
  <p>Please find the official payment receipt attached to this email.</p>
  <p>Regards,<br/><strong>Let's Enterprise Team</strong></p>
  ${EMAIL_FOOTER}
</body>
</html>`

  try {
    const info = await transporter.sendMail({
      from,
      to: payload.to,
      cc: payload.cc,
      subject: `Payment Receipt — ${payload.installmentLabel} — ${payload.studentName}`,
      html,
      attachments: [
        {
          filename: `Receipt_${payload.receiptNo}.pdf`,
          content: payload.pdfBuffer,
          contentType: 'application/pdf',
        }
      ]
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── Offer emails ──────────────────────────────────────────────────────────────

export type OfferEmailPayload = {
  to: string[]
  cc?: string[]
  studentName: string
  programName: string
  batchYear: number
  offerExpiryDate: Date
  bodyText: string          // from SystemSetting OFFER_EMAIL_BODY
  bankDetails: string       // from SystemSetting BANK_DETAILS
  offerLetterPdf: Buffer    // generated offer letter PDF
  proposalPdf?: Buffer      // optional fee breakdown proposal PDF
}

// Logo URL for email headers — uses the light-mode (dark-text) logo served from /public
const LOGO_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://le-student-roster.vercel.app"}/le-logo-light.png`

const EMAIL_HEADER = `
  <div style="padding:24px 0 20px;border-bottom:2px solid #3663AD;margin-bottom:24px;">
    <img src="${LOGO_URL}" alt="Let's Enterprise" height="40" style="display:block;max-width:200px;height:40px;object-fit:contain;" />
    <p style="margin:6px 0 0;font-size:11px;color:#64748b;letter-spacing:0.04em;">Work is the Curriculum</p>
  </div>`

const EMAIL_FOOTER = `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.6;">
    <strong style="color:#475569;">Let's Enterprise</strong><br/>
    6th Floor, Trimurty Honeygold, 44 Range Hill Road, Sinchan Nagar, Ashok Nagar, Pune, Maharashtra 411016<br/>
    <a href="https://www.letsenterprise.in" style="color:#3663AD;text-decoration:none;">www.letsenterprise.in</a> &nbsp;·&nbsp; +91 84472 84008
  </div>`

function offerEmailHtml(payload: OfferEmailPayload) {
  const expiry = payload.offerExpiryDate.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })
  const body = payload.bodyText
    .replace(/{{studentName}}/g, payload.studentName)
    .replace(/{{programName}}/g, payload.programName)
    .replace(/{{batchYear}}/g, String(payload.batchYear))
    .replace(/{{offerExpiryDate}}/g, expiry)
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")

  const bankHtml = payload.bankDetails
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;font-size:15px;line-height:1.6;background:#fff;">
  ${EMAIL_HEADER}
  <div>${body}</div>
  <div style="margin-top:20px;padding:16px;background:#f4f7fc;border-radius:6px;font-size:14px;">
    <strong>Payment Details:</strong><br/>${bankHtml}
  </div>
  <p style="margin-top:20px;font-size:13px;color:#555;">Your official Offer Letter is attached to this email.</p>
  ${EMAIL_FOOTER}
</body>
</html>`
}

export async function sendOfferEmail(payload: OfferEmailPayload): Promise<SendResult> {
  if (!payload.to.length) return { ok: false, skipped: true, reason: "No recipient email" }
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)
  const expiry = payload.offerExpiryDate.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })

  const programSlug = payload.programName.split(/\s*[-–]\s*/)[0].trim().replace(/\s+/g, "")
  const studentSlug = payload.studentName.replace(/\s+/g, "")
  const dateSlug = payload.offerExpiryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/\s+/g, "")
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [
    { filename: `LE-${programSlug}-${studentSlug}-OfferLetter-${dateSlug}.pdf`, content: payload.offerLetterPdf, contentType: "application/pdf" },
  ]
  if (payload.proposalPdf) {
    attachments.push({ filename: `LE-${programSlug}-${studentSlug}-FeeDetails.pdf`, content: payload.proposalPdf, contentType: "application/pdf" })
  }

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      cc: payload.cc,
      subject: `Offer of Admission — ${payload.programName} (${payload.batchYear}) — Confirm by ${expiry}`,
      html: offerEmailHtml(payload),
      attachments,
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export type OfferReminderPayload = {
  to: string
  studentName: string
  programName: string
  offerExpiryDate: Date
  daysLeft: number
  reminderNumber: 1 | 2
  bodyText: string   // from SystemSetting OFFER_REMINDER_1_BODY or OFFER_REMINDER_2_BODY
}

function offerReminderHtml(payload: OfferReminderPayload) {
  const expiry = payload.offerExpiryDate.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })
  const body = payload.bodyText
    .replace(/{{studentName}}/g, payload.studentName)
    .replace(/{{programName}}/g, payload.programName)
    .replace(/{{daysLeft}}/g, String(payload.daysLeft))
    .replace(/{{offerExpiryDate}}/g, expiry)
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;font-size:15px;line-height:1.6;background:#fff;">
  ${EMAIL_HEADER}
  <div>${body}</div>
  ${EMAIL_FOOTER}
</body>
</html>`
}

export async function sendOfferReminderEmail(payload: OfferReminderPayload): Promise<SendResult> {
  if (!payload.to) return { ok: false, skipped: true, reason: "No recipient email" }
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)
  const expiry = payload.offerExpiryDate.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      subject: `Reminder: Confirm your ${payload.programName} offer by ${expiry} (${payload.daysLeft} days left)`,
      html: offerReminderHtml(payload),
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export type RevisedOfferPayload = OfferEmailPayload  // same shape, different subject line

export async function sendRevisedOfferEmail(payload: RevisedOfferPayload): Promise<SendResult> {
  if (!payload.to.length) return { ok: false, skipped: true, reason: "No recipient email" }
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)
  const rProgramSlug = payload.programName.split(/\s*[-–]\s*/)[0].trim().replace(/\s+/g, "")
  const rStudentSlug = payload.studentName.replace(/\s+/g, "")
  const rDateSlug = payload.offerExpiryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/\s+/g, "")
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [
    { filename: `LE-${rProgramSlug}-${rStudentSlug}-OfferLetter-${rDateSlug}.pdf`, content: payload.offerLetterPdf, contentType: "application/pdf" },
  ]
  if (payload.proposalPdf) {
    attachments.push({ filename: `LE-${rProgramSlug}-${rStudentSlug}-FeeDetails.pdf`, content: payload.proposalPdf, contentType: "application/pdf" })
  }

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      cc: payload.cc,
      subject: `Updated Offer — ${payload.programName} (${payload.batchYear}) — Your seat is still available`,
      html: offerEmailHtml(payload),
      attachments,
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export type OnboardingEmailPayload = {
  to: string[]
  cc?: string[]
  studentName: string
  programName: string
  bodyText: string          // from SystemSetting ONBOARDING_EMAIL_BODY
  handbookUrl?: string      // from SystemSetting ONBOARDING_HANDBOOK_URL
  welcomeKitUrl?: string    // from SystemSetting ONBOARDING_WELCOME_KIT_URL
  year1Url?: string         // from SystemSetting ONBOARDING_YEAR1_URL
  proposalPdf: Buffer       // full proposal with roll number + installments
}

function onboardingEmailHtml(payload: OnboardingEmailPayload) {
  const body = payload.bodyText
    .replace(/{{studentName}}/g, payload.studentName)
    .replace(/{{programName}}/g, payload.programName)
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")

  const links = [
    payload.year1Url ? `<li><a href="${payload.year1Url}">Program Flow (Year 1)</a></li>` : "",
    payload.handbookUrl ? `<li><a href="${payload.handbookUrl}">Onboarding Handbook</a></li>` : "",
    payload.welcomeKitUrl ? `<li><a href="${payload.welcomeKitUrl}">Working BBA Welcome Kit</a></li>` : "",
  ].filter(Boolean).join("\n")

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;font-size:15px;line-height:1.6;background:#fff;">
  ${EMAIL_HEADER}
  <div>${body}</div>
  ${links ? `<ul style="margin-top:16px;">${links}</ul>` : ""}
  <p style="margin-top:16px;font-size:13px;color:#555;">Your personalised fee structure document is attached.</p>
  ${EMAIL_FOOTER}
</body>
</html>`
}

export async function sendOnboardingEmail(payload: OnboardingEmailPayload): Promise<SendResult> {
  if (!payload.to.length) return { ok: false, skipped: true, reason: "No recipient email" }
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      cc: payload.cc,
      subject: `Welcome to ${payload.programName} — Let's Enterprise`,
      html: onboardingEmailHtml(payload),
      attachments: [
        { filename: `Fee_Structure_${payload.studentName.replace(/\s+/g, "_")}.pdf`, content: payload.proposalPdf, contentType: "application/pdf" },
      ],
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
