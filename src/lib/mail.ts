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
  paymentInstructions?: string
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
  const { studentName, installmentLabel, amount, dueDate, reminderType, paymentInstructions } = payload

  const urgencyLabel: Record<string, string> = {
    ONE_MONTH: "📅 Due in 1 Month",
    ONE_WEEK:  "⚠️ Due in 1 Week",
    DUE_DATE:  "🔴 Due Today",
  }

  const formattedDate = dueDate.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(amount)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);padding:32px 40px;">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Let's Enterprise</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:800;color:#ffffff;">Fee Reminder</h1>
            </td>
          </tr>

          <!-- Badge -->
          <tr>
            <td style="padding:0 40px;">
              <div style="display:inline-block;margin-top:24px;padding:6px 14px;background:#fef3c7;border:1.5px solid #fcd34d;border-radius:999px;font-size:12px;font-weight:700;color:#92400e;">
                ${urgencyLabel[reminderType]}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 40px 32px;">
              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                Dear <strong>${studentName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                This is a reminder that your upcoming fee payment is due soon. Please find the details below.
              </p>

              <!-- Details card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;">
                          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Installment</p>
                          <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0f172a;">${installmentLabel}</p>
                        </td>
                      </tr>
                      <tr><td style="padding:8px 0;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" /></td></tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Amount Due</p>
                          <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#4f46e5;">${formattedAmount}</p>
                        </td>
                      </tr>
                      <tr><td style="padding:8px 0;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" /></td></tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Due Date</p>
                          <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0f172a;">${formattedDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${paymentInstructions ? `
              <div style="margin-top:24px;padding:16px 20px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;">
                <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#166534;">Payment Instructions</p>
                <p style="margin:8px 0 0;font-size:14px;color:#15803d;line-height:1.6;">${paymentInstructions}</p>
              </div>
              ` : ""}

              <p style="margin:28px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                If you have already made this payment, please disregard this message or contact us to confirm receipt.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Let's Enterprise · This is an automated reminder. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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
