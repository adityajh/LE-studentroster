import nodemailer from "nodemailer"
import { prisma } from "./prisma"

// ── Student/parent email config ───────────────────────────────────────────────
//
// All student- and parent-facing emails use the Hostinger SMTP account
// configured in Settings → Emails (hi@letsenterprise.in by default).
//
// Priority order for SMTP credentials:
//   1. SystemSetting in DB (set via /settings → Emails tab)
//   2. Environment variables (REMINDER_GMAIL_USER / REMINDER_GMAIL_APP_PASSWORD)
//
// The admin login magic link is separate — it uses GMAIL_USER / GMAIL_APP_PASSWORD
// via NextAuth (auth.ts) and should never be mixed with student-facing emails.
//
// SystemSetting keys:
//   SMTP_USER         — Hostinger email address (hi@letsenterprise.in)
//   SMTP_PASSWORD     — Hostinger email password
//   SMTP_FROM_NAME    — Display name, e.g. "Let's Enterprise"
//   SMTP_FROM_EMAIL   — Override "from" address (defaults to SMTP_USER)

export type ReminderEmailPayload = {
  to: string | string[]
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

/**
 * Returns email addresses of team members flagged ccOnEmails=true.
 * These addresses are added to the CC list of every student/parent-facing
 * email below, so admins / programme staff can monitor outgoing comms.
 *
 * The admin login magic link is NOT routed through this file (NextAuth uses
 * its own nodemailer provider in auth.ts), so login emails are unaffected.
 */
async function getTeamCcEmails(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { ccOnEmails: true },
    select: { email: true },
  })
  return users.map((u) => u.email).filter((e) => e && e.length > 0)
}

/** Merge team CC list with any existing per-call CC, dedupe, return undefined if empty. */
async function buildCc(extra?: string[]): Promise<string[] | undefined> {
  const team = await getTeamCcEmails()
  const merged = Array.from(new Set([...(extra ?? []), ...team].filter(Boolean)))
  return merged.length > 0 ? merged : undefined
}

// ── Global merge tags ────────────────────────────────────────────────────────
//
// A small set of merge tags are global: they resolve from SystemSetting values
// and can be used in any admin-edited email body (offer email, reminders,
// onboarding, etc.). The substitution happens BEFORE per-email tag replacement
// and BEFORE the `\n → <br/>` HTML conversion.
//
// Tags:
//   {{bankDetails}}    — from SystemSetting BANK_DETAILS
//   {{cashFreeLink}}   — from SystemSetting CASH_FREE_LINK
//   {{<key>}}          — each entry in SystemSetting RESOURCE_LINKS_JSON
//                        (JSON array of {key, label, url})

export type ResourceLink = { key: string; label: string; url: string }

export async function getResourceLinks(): Promise<ResourceLink[]> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: "RESOURCE_LINKS_JSON" },
    select: { value: true },
  })
  if (!row?.value) return []
  try {
    const parsed = JSON.parse(row.value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is ResourceLink =>
        x && typeof x.key === "string" && typeof x.label === "string" && typeof x.url === "string"
    )
  } catch {
    return []
  }
}

export async function getGlobalMergeTags(): Promise<Record<string, string>> {
  const [settings, links] = await Promise.all([
    prisma.systemSetting.findMany({
      where: { key: { in: ["BANK_DETAILS", "CASH_FREE_LINK"] } },
      select: { key: true, value: true },
    }),
    getResourceLinks(),
  ])
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  const tags: Record<string, string> = {
    bankDetails: map["BANK_DETAILS"] || "",
    cashFreeLink: map["CASH_FREE_LINK"] || "",
  }
  for (const l of links) {
    if (l.key && l.url) tags[l.key] = l.url
  }
  return tags
}

/** Substitute only known global tags; unknown {{...}} patterns are left untouched
 *  so per-email merge fields (studentName, amount, etc.) can be resolved later. */
export function applyGlobalMergeTags(text: string, tags: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in tags ? tags[key] : match
  )
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
  const recipients = Array.isArray(payload.to) ? payload.to.filter(Boolean) : [payload.to].filter(Boolean)
  if (!recipients.length) {
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

  // Expand {{bankDetails}}, {{cashFreeLink}}, and any resource-link tags before
  // per-email substitution.
  const globalTags = await getGlobalMergeTags()
  const expanded: ReminderEmailPayload = {
    ...payload,
    bodyText: applyGlobalMergeTags(payload.bodyText, globalTags),
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: recipients,
      cc: await buildCc(),
      subject: reminderSubject(payload.reminderType, payload.installmentLabel),
      html: reminderHtml(expanded),
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
      cc: await buildCc(payload.cc),
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

  const globalTags = await getGlobalMergeTags()
  const expanded: OfferEmailPayload = {
    ...payload,
    bodyText: payload.bodyText !== undefined ? applyGlobalMergeTags(payload.bodyText, globalTags) : payload.bodyText,
  }

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      cc: await buildCc(payload.cc),
      subject: `Offer of Admission — ${payload.programName} (${payload.batchYear}) — Confirm by ${expiry}`,
      html: offerEmailHtml(expanded),
      attachments,
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export type OfferReminderPayload = {
  to: string | string[]
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
  const recipients = Array.isArray(payload.to) ? payload.to.filter(Boolean) : [payload.to].filter(Boolean)
  if (!recipients.length) return { ok: false, skipped: true, reason: "No recipient email" }
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)
  const expiry = payload.offerExpiryDate.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })

  const globalTags = await getGlobalMergeTags()
  const expanded: OfferReminderPayload = {
    ...payload,
    bodyText: payload.bodyText !== undefined ? applyGlobalMergeTags(payload.bodyText, globalTags) : payload.bodyText,
  }

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: recipients,
      cc: await buildCc(),
      subject: `Reminder: Confirm your ${payload.programName} offer by ${expiry} (${payload.daysLeft} days left)`,
      html: offerReminderHtml(expanded),
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

  const rGlobalTags = await getGlobalMergeTags()
  const rExpanded: RevisedOfferPayload = {
    ...payload,
    bodyText: payload.bodyText !== undefined ? applyGlobalMergeTags(payload.bodyText, rGlobalTags) : payload.bodyText,
  }

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      cc: await buildCc(payload.cc),
      subject: `Updated Offer — ${payload.programName} (${payload.batchYear}) — Your seat is still available`,
      html: offerEmailHtml(rExpanded),
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
  bodyText: string                                    // from SystemSetting ONBOARDING_EMAIL_BODY
  resourceLinks?: { label: string; url: string }[]    // from SystemSetting RESOURCE_LINKS_JSON
  proposalPdf: Buffer                                 // full proposal with roll number + installments
}

function onboardingEmailHtml(payload: OnboardingEmailPayload) {
  const body = payload.bodyText
    .replace(/{{studentName}}/g, payload.studentName)
    .replace(/{{programName}}/g, payload.programName)
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")

  const validLinks = (payload.resourceLinks ?? []).filter((l) => l.url && l.label)
  const links = validLinks
    .map((l) => `<li><a href="${l.url}">${l.label}</a></li>`)
    .join("\n")

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

// ── Enrolment confirmation email ──────────────────────────────────────────────

export type EnrolmentConfirmationEmailPayload = {
  to: string[]
  cc?: string[]
  studentName: string
  programName: string
  rollNo: string
  onboardingUrl: string
  onboardingExpiresAt: Date
  feeLetterPdf: Buffer
  bodyText?: string   // from SystemSetting ENROLMENT_CONFIRMATION_EMAIL_BODY
}

const DEFAULT_ENROLMENT_CONFIRMATION_BODY = `Dear {{studentName}},

Congratulations! Your enrolment in {{programName}} at Let's Enterprise is now confirmed.

Your Roll Number: {{rollNo}}

Your personalised fee structure is attached to this email. Please review it carefully.

As the next step, please complete your profile using the link below. This link is valid until {{onboardingExpiryDate}}.`

export async function sendEnrolmentConfirmationEmail(payload: EnrolmentConfirmationEmailPayload): Promise<SendResult> {
  if (!payload.to.length) return { ok: false, skipped: true, reason: "No recipient email" }
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)
  const expiry = payload.onboardingExpiresAt.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })

  const ecGlobalTags = await getGlobalMergeTags()
  const rawBody = applyGlobalMergeTags(payload.bodyText || DEFAULT_ENROLMENT_CONFIRMATION_BODY, ecGlobalTags)
    .replace(/{{studentName}}/g, payload.studentName)
    .replace(/{{programName}}/g, payload.programName)
    .replace(/{{rollNo}}/g, payload.rollNo)
    .replace(/{{onboardingExpiryDate}}/g, expiry)
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;font-size:15px;line-height:1.6;background:#fff;">
  ${EMAIL_HEADER}
  <div>${rawBody}</div>
  <div style="margin:28px 0;text-align:center;">
    <a href="${payload.onboardingUrl}" style="display:inline-block;background:#3663AD;color:#ffffff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.02em;">
      Complete Your Profile →
    </a>
  </div>
  <p style="font-size:13px;color:#64748b;">Or copy this link:<br/><a href="${payload.onboardingUrl}" style="color:#3663AD;word-break:break-all;">${payload.onboardingUrl}</a></p>
  <p>If you have any questions, please reach out to your programme coordinator.</p>
  ${EMAIL_FOOTER}
</body>
</html>`

  const programSlug = payload.programName.split(/\s*[-–]\s*/)[0].trim().replace(/\s+/g, "")
  const studentSlug = payload.studentName.replace(/\s+/g, "")

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      cc: await buildCc(payload.cc),
      subject: `Welcome to ${payload.programName} — Enrolment Confirmed`,
      html,
      attachments: [
        {
          filename: `LE-${programSlug}-${studentSlug}-FeeDetails.pdf`,
          content: payload.feeLetterPdf,
          contentType: "application/pdf",
        },
      ],
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Self-onboarding link email ────────────────────────────────────────────────

export type OnboardingLinkEmailPayload = {
  to: string[]
  studentName: string
  programName: string
  onboardingUrl: string  // full URL with token
  expiresAt: Date
  bodyText?: string      // from SystemSetting SELF_ONBOARDING_LINK_EMAIL_BODY
}

const DEFAULT_ONBOARDING_LINK_BODY = `Dear {{studentName}},

Congratulations on your enrolment in {{programName}} at Let's Enterprise. You're one step away from completing your profile.

Please click the button below to fill in your details. The link expires on {{onboardingExpiryDate}}.`

export async function sendOnboardingLinkEmail(payload: OnboardingLinkEmailPayload): Promise<SendResult> {
  if (!payload.to.length) return { ok: false, skipped: true, reason: "No recipient email" }
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)
  const expiry = payload.expiresAt.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })

  const olGlobalTags = await getGlobalMergeTags()
  const rawBody = applyGlobalMergeTags(payload.bodyText || DEFAULT_ONBOARDING_LINK_BODY, olGlobalTags)
    .replace(/{{studentName}}/g, payload.studentName)
    .replace(/{{programName}}/g, payload.programName)
    .replace(/{{onboardingExpiryDate}}/g, expiry)
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;font-size:15px;line-height:1.6;background:#fff;">
  ${EMAIL_HEADER}
  <div>${rawBody}</div>
  <div style="margin:28px 0;text-align:center;">
    <a href="${payload.onboardingUrl}" style="display:inline-block;background:#3663AD;color:#ffffff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.02em;">
      Complete Your Profile →
    </a>
  </div>
  <p style="font-size:13px;color:#64748b;">Or copy this link into your browser:<br/><a href="${payload.onboardingUrl}" style="color:#3663AD;word-break:break-all;">${payload.onboardingUrl}</a></p>
  <p>If you have any questions, please contact your programme coordinator.</p>
  ${EMAIL_FOOTER}
</body>
</html>`

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      cc: await buildCc(),
      subject: `Action Required: Complete Your Profile — ${payload.programName}`,
      html,
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Self-onboarding submitted alert (to team) ─────────────────────────────────

export type OnboardingSubmittedAlertPayload = {
  to: string[]
  studentName: string
  programName: string
  batchYear: number
  studentProfileUrl: string
}

export async function sendOnboardingSubmittedAlert(payload: OnboardingSubmittedAlertPayload): Promise<SendResult> {
  if (!payload.to.length) return { ok: false, skipped: true, reason: "No recipient email" }
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;font-size:15px;line-height:1.6;background:#fff;">
  ${EMAIL_HEADER}
  <p><strong>${payload.studentName}</strong> has submitted their self-onboarding form for <strong>${payload.programName} (${payload.batchYear})</strong>.</p>
  <p>Please review the submitted profile and documents, then approve or request changes.</p>
  <div style="margin:28px 0;text-align:center;">
    <a href="${payload.studentProfileUrl}" style="display:inline-block;background:#3663AD;color:#ffffff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.02em;">
      Review Profile →
    </a>
  </div>
  ${EMAIL_FOOTER}
</body>
</html>`

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      subject: `[Action Needed] ${payload.studentName} submitted onboarding form`,
      html,
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function sendOnboardingEmail(payload: OnboardingEmailPayload): Promise<SendResult> {
  if (!payload.to.length) return { ok: false, skipped: true, reason: "No recipient email" }
  const config = await getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: "SMTP not configured" }

  const transporter = createTransporter(config)

  const oeGlobalTags = await getGlobalMergeTags()
  const oeExpanded: OnboardingEmailPayload = {
    ...payload,
    bodyText: applyGlobalMergeTags(payload.bodyText, oeGlobalTags),
  }

  try {
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: payload.to,
      cc: await buildCc(payload.cc),
      subject: `Welcome to ${payload.programName} — Let's Enterprise`,
      html: onboardingEmailHtml(oeExpanded),
      attachments: [
        { filename: `Fee_Structure_${payload.studentName.replace(/\s+/g, "_")}.pdf`, content: payload.proposalPdf, contentType: "application/pdf" },
      ],
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
