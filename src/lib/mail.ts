import nodemailer from "nodemailer"

// ── Reminder email config (separate from auth SMTP) ──────────────────────────
//
// Set these in .env.local / Vercel env vars when ready.
// If not set, sendFeeReminder() will return { skipped: true } without throwing.
//
// REMINDER_EMAIL_FROM   — e.g. "LE Fees <fees@letsent.com>"
// REMINDER_GMAIL_USER   — the Gmail account
// REMINDER_GMAIL_APP_PASSWORD — App Password for that account

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

function createTransporter() {
  const user = process.env.REMINDER_GMAIL_USER
  const pass = process.env.REMINDER_GMAIL_APP_PASSWORD
  if (!user || !pass) return null

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
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

  // Safely inject text and convert newlines to `<br/>`
  let htmlMessage = bodyText
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{{studentName}}/g, studentName)
    .replace(/{{installmentLabel}}/g, installmentLabel)
    .replace(/{{dueDate}}/g, formattedDate)
    .replace(/{{amount}}/g, formattedAmount)
    .replace(/\n/g, "<br/>")

  const pmInstructions = paymentInstructions 
    ? `<p style="margin-top:20px; font-weight:bold;">Payment Instructions:</p><p>${paymentInstructions.replace(/\n/g, '<br/>')}</p>` 
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
  const transporter = createTransporter()

  if (!transporter) {
    return {
      ok: false,
      skipped: true,
      reason: "REMINDER_GMAIL_USER or REMINDER_GMAIL_APP_PASSWORD not configured",
    }
  }

  if (!payload.to) {
    return { ok: false, skipped: true, reason: "Student has no email address" }
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.REMINDER_EMAIL_FROM || process.env.REMINDER_GMAIL_USER,
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
