import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import nodemailer from "nodemailer"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { to } = await req.json()
  if (!to) return NextResponse.json({ error: "Recipient email is required" }, { status: 400 })

  // Load SMTP config from DB / env
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_NAME", "SMTP_FROM_EMAIL"] } },
  })
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value

  const user = map["SMTP_USER"] || process.env.REMINDER_GMAIL_USER || ""
  const pass = map["SMTP_PASSWORD"] || process.env.REMINDER_GMAIL_APP_PASSWORD || ""

  if (!user || !pass) {
    return NextResponse.json({ error: "SMTP not configured — set Email Address and Password in Settings → Email." }, { status: 503 })
  }

  const fromName  = map["SMTP_FROM_NAME"]  || "Let's Enterprise"
  const fromEmail = map["SMTP_FROM_EMAIL"] || user

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    })

    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject: "Test Email — Let's Enterprise Student Roster",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;border:1px solid #e2e8f0;border-radius:12px">
          <p style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 8px">✅ Email is working!</p>
          <p style="font-size:14px;color:#475569;margin:0 0 16px">
            This test email was sent from the <strong>Let's Enterprise Student Roster</strong> via
            <strong>${fromEmail}</strong> using Hostinger SMTP.
          </p>
          <p style="font-size:12px;color:#94a3b8;margin:0">Sent at ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true, sentTo: to, from: fromEmail })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send test email" },
      { status: 500 }
    )
  }
}
