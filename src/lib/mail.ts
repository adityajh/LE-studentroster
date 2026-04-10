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
    host: "smtp.gmail.com",
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
  <div>
    ${htmlMessage}
    ${pmInstructions}
  </div>
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

  const html = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
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
    </div>
  `

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
